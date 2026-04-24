# Resend Email Sequence Setup Guide

This guide walks through setting up the 5-touch drip sequence in Resend for a new client deployment. Complete this setup once per client. The sequence fires automatically each time a new contact is added to the Resend audience — which happens the moment a lead submits your form.

---

## Sequence Overview

| Touch | Timing | Subject line | Purpose |
|---|---|---|---|
| 1 | Immediate | Got your message, {{firstName}} | Instant acknowledgement |
| 2 | 1 hour after | One thing most businesses miss | Soft value hook |
| 3 | 24 hours after | A few examples of what we've done | Social proof |
| 4 | 3 days after | Still thinking it over? | Low-pressure follow-up |
| 5 | 7 days after | Last one from us | Final nudge + close |

---

## Section 1 — Create a Resend Account and Verify Your Sending Domain

### Create your account
1. Go to [resend.com](https://resend.com) and sign up
2. Verify your email address

### Add and verify your sending domain
You must use your own domain as the sender (e.g. `hello@sparkle-cleaning.com.au`). Free email addresses like Gmail are not supported for transactional drip sequences.

1. In Resend, go to **Domains** → **Add Domain**
2. Enter your domain (e.g. `sparkle-cleaning.com.au`)
3. Resend will give you DNS records to add (DKIM, SPF, DMARC)
4. Log in to your domain registrar (e.g. GoDaddy, Namecheap, Crazy Domains) and add these records
5. Return to Resend and click **Verify** — this may take 5–30 minutes to propagate
6. Once verified, the domain shows **Active**

---

## Section 2 — Create an Audience

1. In Resend, go to **Audiences** → **Create Audience**
2. Name it `[Business Name] Leads` (e.g. `Sparkle Cleaning Leads`)
3. Copy the **Audience ID** — you will need this for your `.env` file (`RESEND_AUDIENCE_ID`)

---

## Section 3 — Configure the 5-Email Sequence

Resend does not have a built-in drip sequence builder. The sequence is triggered by adding a contact to the audience (which the webhook does automatically). You configure individual broadcast templates and use Resend's API or workflow feature to send timed follow-ups.

**Recommended approach:** Use Resend Broadcasts with scheduled send times, or connect Resend to your n8n workflow for timed follow-ups. Topues can configure the n8n automation for you if required.

For each email below, create a **Broadcast template** in Resend:

---

### Email 1 — Immediate acknowledgement

**Subject:** Got your message, {{firstName}}

**Body:**

```
Hi {{firstName}},

Thanks for getting in touch with {{businessName}}.

We've received your message and one of us will be in contact shortly to talk through what you need.

In the meantime, if your question is urgent, you can book a time directly here: {{bookingUrl}}

Talk soon,
The {{businessName}} team
```

**Settings:**
- Send timing: Immediately on audience add
- From: `{{RESEND_FROM_NAME}} <{{RESEND_FROM_EMAIL}}>`
- Reply-to: your business email

---

### Email 2 — Soft value hook (1 hour)

**Subject:** One thing most businesses miss

**Body:**

```
Hi {{firstName}},

Most businesses wait too long to follow up with people who reach out. By then, the person has already moved on.

We built our process around the opposite — respond fast, keep it simple, and make it easy to take the next step.

If you want to see how we can help {{businessName}} do the same, book a 15-minute call here: {{bookingUrl}}

No pressure, no pitch. Just a conversation.

The {{businessName}} team
```

**Settings:**
- Send timing: 1 hour after contact is added to audience

---

### Email 3 — Social proof (24 hours)

**Subject:** A few examples of what we've done

**Body:**

```
Hi {{firstName}},

A few things we've helped businesses like yours with recently:

— A local tradie who was losing leads because his website looked outdated. We fixed that in a week. He's now booking 3–4 new jobs a month from his site alone.

— A cleaning business owner who was spending 20 minutes per enquiry on back-and-forth emails. We automated her first response and booking process. That time is now zero.

— A café that had no online presence. Three weeks later, they had a site, a Google Business listing, and their first 5-star review from a customer who found them online.

If any of that sounds familiar, a conversation costs nothing: {{bookingUrl}}

The {{businessName}} team
```

**Settings:**
- Send timing: 24 hours after contact is added to audience

---

### Email 4 — Low-pressure follow-up (3 days)

**Subject:** Still thinking it over?

**Body:**

```
Hi {{firstName}},

Just checking in — no rush at all.

If you're still working out whether now's the right time, that's completely fine. We work with a lot of business owners who reach out before they're fully ready.

When you are ready, we'll be here. And if something specific is holding you back, I'm happy to answer any questions you have before you commit to anything.

Reply to this email or book a time: {{bookingUrl}}

The {{businessName}} team
```

**Settings:**
- Send timing: 3 days after contact is added to audience

---

### Email 5 — Final nudge (7 days)

**Subject:** Last one from us

**Body:**

```
Hi {{firstName}},

This is the last email in this sequence — we don't believe in flooding your inbox.

If the timing hasn't been right, no hard feelings. Our door stays open whenever you're ready.

And if you've already sorted things out elsewhere, that's great too.

But if you're still thinking about it — this is a good moment to take one small step. Even just a 15-minute call to see if we're a fit: {{bookingUrl}}

Either way, thanks for reaching out. It was good to hear from you.

The {{businessName}} team
```

**Settings:**
- Send timing: 7 days after contact is added to audience

---

## Section 4 — Customise Template Variables Per Client

Before activating for any client, update these placeholder values in every template:

| Variable | What to replace with |
|---|---|
| `{{businessName}}` | The client's business name (e.g. "Sparkle Cleaning") |
| `{{bookingUrl}}` | The client's booking page URL (Calendly, Acuity, etc.) |
| `{{RESEND_FROM_NAME}}` | The sender name set in Vercel env vars |
| `{{RESEND_FROM_EMAIL}}` | The verified sending address set in Vercel env vars |

`{{firstName}}` is populated automatically by Resend from the contact data the webhook sends.

---

## Section 5 — Verify the Sequence Fires

After setup, test the full flow:

1. Run the test webhook command from `ONBOARDING.md` Section 5
2. In Resend, go to **Audiences** → select your audience → confirm the test contact appears
3. In Resend, go to **Emails** → confirm the first email was sent within 60 seconds
4. Check the test email inbox for Email 1
5. The remaining 4 emails will fire on their scheduled delay — you do not need to wait for all of them during initial testing

If the contact does not appear in the audience, check:
- `RESEND_API_KEY` in your Vercel env vars is correct
- `RESEND_AUDIENCE_ID` matches the audience you created
- The Vercel function logs for any error messages (Vercel dashboard → Functions → webhook → Logs)
