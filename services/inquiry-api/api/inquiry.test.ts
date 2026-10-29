/**
 * Run with:  node --experimental-strip-types api/inquiry.test.ts
 *
 * Exercises the handler end to end with a stubbed fetch, so the validation,
 * cleaning, and header-injection defences are checked without sending mail.
 */
import handler from './inquiry.ts';

process.env.BREVO_API_KEY = 'test-key';
process.env.INQUIRY_TO = 'info@smashglass.com';

interface Sent {
  url: string;
  body: Record<string, unknown>;
}

let sent: Sent[] = [];
const realFetch = globalThis.fetch;

globalThis.fetch = (async (url: string, init: RequestInit) => {
  sent.push({ url: String(url), body: JSON.parse(String(init.body)) });
  return { ok: true, status: 200, text: async () => '' } as Response;
}) as typeof fetch;

function mockRes() {
  const r: Record<string, unknown> = { statusCode: 0, payload: undefined, headers: {} };
  return Object.assign(r, {
    setHeader(k: string, v: string) {
      (r.headers as Record<string, string>)[k] = v;
      return this;
    },
    status(c: number) {
      r.statusCode = c;
      return this;
    },
    json(p: unknown) {
      r.payload = p;
      return this;
    },
    end() {
      return this;
    },
  });
}

const VALID = {
  email: 'cto@acme.com',
  problem: 'Our parts reconciliation takes a person two days every month and still misses things.',
  project_type: 'Business process automation',
  budget: '$1,500 - $5,000',
  contact_preference: 'Email',
};

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass++;
    console.log(`  ok    ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

let ipSeq = 0;

/** Each call gets a fresh IP by default, so the rate limiter only affects
 *  the test that is deliberately exercising it. */
async function call(body: unknown, method = 'POST', ip?: string) {
  sent = [];
  const res = mockRes();
  await handler(
    {
      method,
      headers: {
        origin: 'https://www.smashglass.com',
        'x-forwarded-for': ip ?? `10.0.0.${++ipSeq % 250}`,
      },
      body,
    } as never,
    res as never
  );
  return res;
}

/** Assert a mail was actually sent, so body assertions can't pass vacuously. */
function sentBody(): Record<string, unknown> {
  if (sent.length !== 1) throw new Error(`expected 1 mail, got ${sent.length}`);
  return sent[0].body;
}

const run = async () => {
  console.log('\ninquiry endpoint\n');

  let r = await call(VALID);
  check('valid submission returns 200', r.statusCode === 200, `got ${r.statusCode}`);
  check('valid submission sends one mail', sent.length === 1, `sent ${sent.length}`);
  check('sends via Brevo', sent[0]?.url.includes('api.brevo.com') ?? false);
  check(
    'reply-to is the submitter',
    (sent[0]?.body as { replyTo?: { email: string } })?.replyTo?.email === 'cto@acme.com'
  );

  r = await call({ ...VALID, _gotcha: 'i am a bot' });
  check('honeypot returns 200 (no retry signal)', r.statusCode === 200);
  check('honeypot sends nothing', sent.length === 0, `sent ${sent.length}`);

  r = await call({ ...VALID, email: 'not-an-email' });
  check('rejects malformed email', r.statusCode === 400);

  r = await call({ ...VALID, problem: 'too short' });
  check('rejects a too-short problem', r.statusCode === 400);

  r = await call({ ...VALID, project_type: 'Something I made up' });
  check('rejects project_type outside the allowed list', r.statusCode === 400);

  r = await call({ ...VALID, budget: '$999,999' });
  check('rejects budget outside the allowed list', r.statusCode === 400);

  // Header injection: CR/LF in the address must never reach a mail header.
  r = await call({ ...VALID, email: 'a@b.com\r\nBcc: victim@elsewhere.com' });
  const injected = r.statusCode === 200 ? JSON.stringify(sentBody()) : '';
  check(
    'header injection is blocked',
    r.statusCode === 400 || (!injected.includes('\r') && !injected.includes('Bcc')),
    injected.slice(0, 80)
  );

  // Control characters in free text must be stripped.
  r = await call({ ...VALID, problem: 'Line one\x07\x00 and a bell\x1B[31m escape sequence here.' });
  const textSent = String((sentBody() as { textContent?: string }).textContent ?? '');
  check(
    'strips control characters',
    textSent.length > 0 && !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(textSent),
    `len ${textSent.length}`
  );

  // HTML in the problem must not render as markup in the email.
  r = await call({ ...VALID, problem: 'We need <script>alert(1)</script> removed from reports.' });
  const htmlSent = String((sentBody() as { htmlContent?: string }).htmlContent ?? '');
  check(
    'escapes HTML in the body',
    htmlSent.includes('&lt;script&gt;') && !htmlSent.includes('<script>')
  );

  // The live form's copy uses an en-dash; the allowlist is written with a
  // hyphen. These are the exact strings the deployed <option> values emit.
  for (const budget of ['$1,500 \u2013 $5,000', '$5,000 \u2013 $15,000']) {
    r = await call({ ...VALID, budget });
    check(`accepts the form's en-dash budget ${JSON.stringify(budget)}`, r.statusCode === 200, `got ${r.statusCode}`);
  }
  r = await call({ ...VALID, budget: '$1,500 - $5,000' });
  check('still accepts the hyphen form', r.statusCode === 200, `got ${r.statusCode}`);
  r = await call({ ...VALID, budget: '  $15,000+  ' });
  check('tolerates surrounding whitespace', r.statusCode === 200, `got ${r.statusCode}`);
  r = await call({ ...VALID, budget: '$999,999' });
  check('still rejects a value outside the list', r.statusCode === 400);

  r = await call(VALID, 'GET');
  check('rejects non-POST', r.statusCode === 405);

  r = await call(VALID, 'OPTIONS');
  check('handles CORS preflight', r.statusCode === 204);

  // Rate limit: 5 per window, so the 6th from the same IP is refused.
  let limited = 0;
  let allowed = 0;
  for (let i = 0; i < 8; i++) {
    const rr = await call(VALID, 'POST', '203.0.113.9');
    if (rr.statusCode === 429) limited++;
    if (rr.statusCode === 200) allowed++;
  }
  check('rate limit allows the first 5', allowed === 5, `allowed ${allowed}`);
  check('rate limit refuses the rest', limited === 3, `429s: ${limited}`);

  globalThis.fetch = realFetch;
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
};

run();
