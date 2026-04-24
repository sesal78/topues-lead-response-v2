# Lead Response System — Client Onboarding Guide

Welcome. This document explains how your automated lead response system works and what you need to do to get it running.

---

## 1. What This System Does

Every time someone submits your contact form or a lead comes in from Facebook or Google Ads, the system automatically captures their details, sends them a personalised email sequence over the next 7 days, sends you an instant Telegram notification, and optionally sends the lead an SMS. Everything is stored in your own Airtable account — Topues does not hold your data.

---

## 2. Setup Checklist

Work through these steps in order. Most take 5–10 minutes each. Topues handles the technical configuration once you provide the credentials.

### Step 1 — Create your Airtable account (lead database)
Airtable is where all your leads are stored. You own this data entirely.

1. Follow the guide at `docs/airtable-setup.md` — it walks through creating the account, building the database structure, and getting your API credentials
2. Once done, send Topues:
   - Your **Airtable API token**
   - Your **Airtable Base ID** (starts with `app`)

### Step 2 — Create your Resend account and verify your domain (email sequences)
Resend sends the automated follow-up emails on your behalf, from your own email address.

1. Follow the guide at `docs/resend-setup.md`
2. You will need to add a few DNS records to your domain — your web host or domain registrar support team can help if needed
3. Once done, send Topues:
   - Your **Resend API key**
   - Your **Resend Audience ID**
   - The **email address** the sequences should send from (must match your verified domain)
   - Your **booking page URL** (e.g. Calendly link) to include in the emails

### Step 3 — Optional: Set up Twilio for SMS replies
If you want new leads to also receive a text message the moment they enquire, you will need a Twilio account.

1. Sign up at [twilio.com](https://twilio.com) (free trial available)
2. Get a phone number from Twilio
3. Send Topues your **Account SID**, **Auth Token**, and **Twilio phone number**

If you do not want SMS, skip this step — it is completely optional.

### Step 4 — Give Topues your Telegram chat ID
This is how you receive instant notifications when a new lead comes in.

1. Open Telegram and search for the bot **@userinfobot**
2. Send it any message — it will reply with your chat ID
3. Share this number with Topues

### Step 5 — Topues configures and deploys
Once Topues has your credentials, they will configure the system and deploy it to Vercel. You do not need to do anything at this stage.

---

## 3. Your Lead Dashboard

Once the system is live, every new lead appears automatically in your Airtable base.

**What each column means:**

| Column | What it shows |
|---|---|
| Name | The lead's name as submitted |
| Email | Their email address |
| Phone | Their phone number (if provided) |
| Message | What they wrote in the form |
| Source | Where the lead came from (Website Form, Facebook Lead Ad, etc.) |
| Stage | Where this lead is in your sales process |
| Created At | When the lead came in |
| Auto Replied At | When the automated email sequence started |
| Notes | Your own notes — the system never touches this column |

**Stage options:**

- **New** — just arrived, auto-sequence started
- **Auto Replied** — sequence is running
- **Engaged** — they replied or clicked a link
- **Booked** — they booked a call or appointment
- **Closed** — you won the job
- **Lost** — did not proceed

Update Stage and Notes manually as you work the lead. Everything else is set by the system.

---

## 4. Your Email Sequences

Your 5-email drip sequence lives in your Resend account.

To find and edit the templates:
1. Log in to [resend.com](https://resend.com)
2. Go to **Broadcasts** (or **Sequences** depending on your setup)
3. Each of the 5 emails is listed there with its subject line

You can edit the body copy of any email at any time. The system uses the latest version for all new contacts added going forward — it does not change emails already sent.

The timing and subject lines are set during initial configuration. If you want to change them, contact Topues.

---

## 5. Testing the System

Once the system is live, you can test it by sending a sample lead. Run this command in your terminal (replace `YOUR_URL` and `YOUR_SECRET` with what Topues provides):

```bash
curl -X POST https://YOUR_URL/api/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: $(echo -n '{"name":"Test Lead","email":"test@example.com","source":"Website Form"}' | openssl dgst -sha256 -hmac 'YOUR_SECRET' | awk '{print "sha256="$2}')" \
  -d '{"name":"Test Lead","email":"test@example.com","source":"Website Form"}'
```

**What to expect:**
- Response: `{"received":true}`
- Airtable: a new row appears in your Leads table within a few seconds
- Resend: the test email address receives Email 1 within 60 seconds
- Telegram: you receive a notification immediately
- SMS (if enabled): the test lead receives an SMS within 60 seconds

If any of these do not happen, contact Topues at hello@topues.com.au.

---

## 6. What Happens If Something Breaks

The system is designed to be self-sufficient. If it stops working, the most common causes are:

- An API key expired or was regenerated (Airtable, Resend, Twilio)
- Your Resend sending domain's DNS records changed
- Your Vercel deployment was paused (rare — Vercel free tier has limits)

**To report an issue:** Email hello@topues.com.au with a description of what is not working and when it started. Include any error messages you see in Airtable or Resend if possible.

Topues aims to respond to system issues within 1 business day.
