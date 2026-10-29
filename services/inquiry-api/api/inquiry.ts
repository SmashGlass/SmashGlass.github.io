import type { VercelRequest, VercelResponse } from '@vercel/node';

/* ------------------------------------------------------------------ *
 * Accepted values. Anything outside these lists is rejected rather than
 * coerced — the form offers a fixed set of choices, so an unexpected
 * value means a stale client or someone poking at the endpoint.
 * ------------------------------------------------------------------ */
const PROJECT_TYPES = [
  'AI agent development',
  'Business process automation',
  'Custom software or integration',
  'Legacy modernization / architecture review',
  'Not sure yet',
] as const;

const BUDGETS = [
  '$1,500 - $5,000',
  '$5,000 - $15,000',
  '$15,000+',
  'Need help sizing it',
] as const;

const CONTACT_PREFS = ['Email', 'Phone call', 'Video call'] as const;

const ALLOWED_ORIGINS = [
  'https://www.smashglass.com',
  'https://smashglass.com',
  'https://dondonkey.github.io',
];

const LIMITS = { problem: 5000, email: 254, minProblem: 10 };

/* ------------------------------------------------------------------ *
 * Cleaning
 * ------------------------------------------------------------------ */

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/** Strip control characters and collapse runaway whitespace. */
function clean(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input
    .normalize('NFC')
    .replace(CONTROL_CHARS, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

/**
 * Anything interpolated into a mail header must not contain CR or LF, or it
 * can be used to inject extra headers (Bcc, Reply-To, ...).
 */
function headerSafe(s: string): string {
  return s.replace(/[\r\n]/g, ' ').trim();
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);
}

function validEmail(e: string): boolean {
  if (e.length > LIMITS.email) return false;
  // Deliberately permissive — the real validation is whether a reply lands.
  return /^[^\s@,;:<>()[\]\\]+@[^\s@.,;:<>()[\]\\]+(\.[^\s@.,;:<>()[\]\\]+)+$/.test(e);
}

function pick<T extends readonly string[]>(value: string, allowed: T): T[number] | null {
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : null;
}

/* ------------------------------------------------------------------ *
 * Rate limiting — best effort only. Serverless instances are ephemeral
 * and not shared, so this stops casual hammering, not a determined
 * flood. Swap in Vercel KV / Upstash if that ever becomes a problem.
 * ------------------------------------------------------------------ */
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) hits.clear(); // crude bound on memory
  return false;
}

/* ------------------------------------------------------------------ *
 * Delivery. Brevo is preferred because smashglass.com is already
 * DKIM-verified there; Resend is supported for portability.
 * ------------------------------------------------------------------ */
interface Mail {
  subject: string;
  html: string;
  text: string;
  replyTo: string;
}

async function send(mail: Mail): Promise<void> {
  const to = process.env.INQUIRY_TO ?? 'info@smashglass.com';
  const from = process.env.INQUIRY_FROM ?? 'website@smashglass.com';

  if (process.env.BREVO_API_KEY) {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { email: from, name: 'SmashGlass website' },
        to: [{ email: to }],
        replyTo: { email: mail.replyTo },
        subject: mail.subject,
        htmlContent: mail.html,
        textContent: mail.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return;
  }

  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: `SmashGlass website <${from}>`,
        to: [to],
        reply_to: mail.replyTo,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
    return;
  }

  throw new Error('No mail provider configured: set BREVO_API_KEY or RESEND_API_KEY');
}

function safeParse(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin ?? '';
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many submissions. Try again shortly.' });
  }

  const raw = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const body = (raw ?? {}) as Record<string, unknown>;

  // Honeypot: a bot fills every field. Report success so it does not retry.
  if (clean(body._gotcha, 100)) return res.status(200).json({ ok: true });

  const email = clean(body.email, LIMITS.email).toLowerCase();
  const problem = clean(body.problem, LIMITS.problem);
  const projectType = pick(clean(body.project_type, 80), PROJECT_TYPES);
  const budget = pick(clean(body.budget, 40), BUDGETS);
  const contactPref = pick(clean(body.contact_preference, 20), CONTACT_PREFS);

  const errors: Record<string, string> = {};
  if (!validEmail(email)) errors.email = 'Enter an email address we can reply to.';
  if (problem.length < LIMITS.minProblem) {
    errors.problem = 'Tell us a little more about the problem.';
  }
  if (!projectType) errors.project_type = 'Choose a project type.';
  if (!budget) errors.budget = 'Choose a budget range.';
  if (!contactPref) errors.contact_preference = 'Choose how you would like to be contacted.';

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Invalid submission', errors });
  }

  const subject = headerSafe(`Project inquiry - ${projectType} - ${budget}`);
  const rows: Array<[string, string]> = [
    ['Project type', projectType!],
    ['Budget', budget!],
    ['Prefers', contactPref!],
    ['Email', email],
    ['Submitted', new Date().toISOString()],
  ];

  const text = [...rows.map(([k, v]) => `${k}: ${v}`), '', 'Problem:', problem].join('\n');

  const html = `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:640px">
      <h2 style="margin:0 0 4px;font-size:18px">New project inquiry</h2>
      <p style="margin:0 0 16px;color:#666;font-size:13px">via smashglass.com</p>
      <table cellpadding="0" cellspacing="0" style="font-size:14px;margin-bottom:20px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:4px 16px 4px 0;color:#666">${escapeHtml(k)}</td>` +
              `<td style="padding:4px 0"><strong>${escapeHtml(v)}</strong></td></tr>`
          )
          .join('')}
      </table>
      <div style="padding:14px 16px;background:#f5f6f7;border-radius:4px;font-size:14px;line-height:1.55;white-space:pre-wrap">${escapeHtml(
        problem
      )}</div>
      <p style="margin-top:20px;font-size:13px">
        <a href="mailto:${escapeHtml(email)}">Reply to ${escapeHtml(email)}</a>
      </p>
    </div>`;

  try {
    await send({ subject, html, text, replyTo: headerSafe(email) });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('inquiry send failed:', err);
    return res.status(502).json({ error: 'Could not send right now.' });
  }
}
