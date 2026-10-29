# Inquiry API

Serverless endpoint behind the "Start a project" form on smashglass.com. It
validates and cleans the submission, then emails it to you. The website stays
a static GitHub Pages build; only this endpoint runs on Vercel.

## Deploy — personal Vercel account

This must live on the **personal** Vercel account, not a work one. Vercel scopes
projects to whichever account you are logged into, so check before deploying.

```bash
npm i -g vercel

# Confirm which account you are on; log out first if it is the wrong one.
vercel whoami
vercel logout        # if needed
vercel login         # choose the personal account

cd services/inquiry-api
vercel link          # when asked for scope, pick the PERSONAL account
vercel --prod
```

`vercel whoami` after `vercel link` should report the personal account. If the
scope prompt only offers a work team, log out and back in with the personal
email.

## Environment variables

Set these in the Vercel project (Settings → Environment Variables), for
Production and Preview:

| Variable | Required | Notes |
| --- | --- | --- |
| `BREVO_API_KEY` | one of | Preferred — smashglass.com is already DKIM-verified in Brevo |
| `RESEND_API_KEY` | one of | Alternative; needs its own domain verification |
| `INQUIRY_TO` | no | Defaults to `info@smashglass.com` |
| `INQUIRY_FROM` | no | Defaults to `website@smashglass.com`; must be on a verified domain |

Only one provider key is needed. Brevo is checked first.

## Point the site at it

After deploying, take the production URL and set it as a repository variable on
`SmashGlass/SmashGlass.github.io` so the site build picks it up:

```bash
gh variable set PUBLIC_FORM_ENDPOINT \
  --repo SmashGlass/SmashGlass.github.io \
  --body "https://<project>.vercel.app/api/inquiry"
```

Then re-run the site deploy. With the variable unset, the form falls back to a
`mailto:` link rather than silently dropping submissions.

## What the endpoint does

- **Rejects unknown values.** `project_type`, `budget`, and `contact_preference`
  must match the form's options exactly. Unexpected values are a stale client or
  someone probing, so they are refused rather than coerced.
- **Strips control characters** from free text, and escapes HTML so a pasted
  `<script>` renders as text in your inbox.
- **Blocks mail header injection** — CR/LF never reach a header, so a crafted
  address cannot add a `Bcc`.
- **Honeypot** — a filled `_gotcha` field returns 200 without sending, so bots
  get no retry signal.
- **Rate limits** 5 submissions per IP per 10 minutes.
- **CORS** is restricted to the live domains and the preview host.

Rate limiting is per warm instance and therefore best effort. It stops casual
hammering, not a determined flood; move to Vercel KV or Upstash if that becomes
a real problem.

## Tests

```bash
npm install
npm test        # 17 assertions, stubs fetch so no mail is sent
npm run typecheck
```
