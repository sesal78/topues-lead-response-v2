# topues-lead-response-v2

Automated lead response system for SMB clients. Built by [Topues AI Studio](https://topues.com).

A single Vercel Edge Function receives leads from any source (website form, Typeform, Facebook Lead Ads, Google Ads), writes them to the client's Airtable base, triggers a 5-email drip sequence via Resend, sends an optional Twilio SMS, and fires an instant Telegram notification to the client.

**Architecture:** Stateless, serverless. No database. No backend owned by Topues. All data lives in the client's own accounts (Airtable, Resend). Each client deployment is a separate Vercel project with their own environment variables.

---

## Project Structure

```
topues-lead-response-v2/
├── api/
│   └── webhook.ts          ← Vercel Edge Function (the entire backend)
├── docs/
│   ├── airtable-setup.md   ← Airtable base setup guide for clients
│   └── resend-setup.md     ← Resend drip sequence setup guide + email copy
├── scripts/
│   └── airtable-setup.ts   ← Optional: programmatic Airtable base creation
├── test/
│   └── webhook.test.ts     ← Vitest tests — all 4 source formats
├── widget/
│   ├── lead-form.html      ← Embeddable lead capture widget (< 50 lines)
│   └── test-page.html      ← Local test page for the widget
├── .env.example            ← All required environment variables
├── ONBOARDING.md           ← Client-facing onboarding document
├── package.json
├── tsconfig.json
└── vercel.json
```

---

## How to Deploy for a New Client

### Step 1 — Fork or clone this repo
```bash
git clone https://github.com/sesal78/topues-lead-response-v2.git client-name-lead-response
cd client-name-lead-response
```

### Step 2 — Install Vercel CLI (first time only)
```bash
npm install -g vercel
```

### Step 3 — Create a new Vercel project linked to the repo
```bash
vercel link
# Follow prompts — create a new project, name it e.g. "clientname-lead-response"
```

### Step 4 — Set all environment variables in Vercel
Do NOT put secrets in the repo. Set them via the Vercel dashboard or CLI:

```bash
vercel env add WEBHOOK_SECRET
vercel env add AIRTABLE_API_KEY
vercel env add AIRTABLE_BASE_ID
vercel env add AIRTABLE_TABLE_NAME
vercel env add RESEND_API_KEY
vercel env add RESEND_AUDIENCE_ID
vercel env add RESEND_FROM_EMAIL
vercel env add RESEND_FROM_NAME
vercel env add TWILIO_ENABLED
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_CHAT_ID
```

### Step 5 — Deploy
```bash
vercel --prod
```

### Step 6 — Update the widget snippet
Open `widget/lead-form.html` and update the two config lines at the top:
```js
const WEBHOOK_URL = 'https://clientname-lead-response.vercel.app/api/webhook';
const WEBHOOK_SECRET = 'the_same_secret_you_set_in_vercel';
```

### Step 7 — Give the client ONBOARDING.md
Walk the client through `ONBOARDING.md` to complete their Airtable and Resend setup.

---

## Local Development

```bash
npm install
cp .env.example .env
# Fill in test values in .env
npx vercel dev
npm test
```

---

## Environment Variables

See `.env.example` for the full list with comments.

Required: `WEBHOOK_SECRET`, `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_NAME`, `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

Optional (SMS): `TWILIO_ENABLED=true`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

---

## Security

- All incoming webhooks must include a valid HMAC-SHA256 signature in `X-Webhook-Signature`
- Rate limiting: 30 requests/minute per IP (in-memory, resets on cold start)
- No secrets stored in this repo — all credentials are Vercel environment variables
- Each client deployment is isolated — separate Vercel project, separate env vars

---

## Support

Built and maintained by Topues AI Studio — hello@topues.com.au
