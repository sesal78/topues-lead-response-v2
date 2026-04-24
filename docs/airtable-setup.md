# Airtable Base Setup Guide

This guide walks through creating the Airtable base that stores all incoming leads for your automated response system. You only need to do this once per client deployment.

---

## Table: Leads

| Field | Type | Notes |
|---|---|---|
| Name | Single line text | Primary field — auto-populated by webhook |
| Email | Email | Required — used to trigger drip sequence |
| Phone | Phone number | Optional — used for SMS if enabled |
| Message | Long text | Lead's message from the form |
| Source | Single line text | e.g. "Website Form", "Facebook Lead Ad" |
| Stage | Single select | New / Auto Replied / Engaged / Booked / Closed / Lost |
| Created At | Date | Set automatically by webhook on each new lead |
| Auto Replied At | Date | Set by webhook after Resend sequence is triggered |
| Notes | Long text | For your own notes — not touched by the system |

---

## Option A — Manual Setup (Recommended for first-time users)

### Step 1 — Create an Airtable account
Go to [airtable.com](https://airtable.com) and sign up for a free account.
The free tier supports up to 1,000 records per base and is sufficient for most SMBs.

### Step 2 — Create a new base
1. Click **+ Add a base** on your Airtable home screen
2. Choose **Start from scratch**
3. Name the base something like `[Your Business] Leads` (e.g. `Sparkle Cleaning Leads`)
4. Click **Create base**

### Step 3 — Rename the default table
Your base starts with a table called `Table 1`. Rename it to `Leads`:
1. Right-click the `Table 1` tab at the bottom
2. Select **Rename table**
3. Type `Leads` and press Enter

### Step 4 — Set up fields
Delete all default fields except `Name` (which is the primary field and cannot be deleted), then add the following fields in order:

**Email**
- Click the `+` button to add a field
- Set field name to `Email`
- Select type: **Email**
- Click **Save**

**Phone**
- Add field `Phone`
- Type: **Phone number**
- Click **Save**

**Message**
- Add field `Message`
- Type: **Long text**
- Click **Save**

**Source**
- Add field `Source`
- Type: **Single line text**
- Click **Save**

**Stage**
- Add field `Stage`
- Type: **Single select**
- Add options in this order: `New`, `Auto Replied`, `Engaged`, `Booked`, `Closed`, `Lost`
- Click **Save**

**Created At**
- Add field `Created At`
- Type: **Date**
- Enable **Include time** if you want timestamps
- Click **Save**

**Auto Replied At**
- Add field `Auto Replied At`
- Type: **Date**
- Enable **Include time**
- Click **Save**

**Notes**
- Add field `Notes`
- Type: **Long text**
- Click **Save**

### Step 5 — Get your API credentials
1. Go to [airtable.com/create/tokens](https://airtable.com/create/tokens)
2. Click **+ Add a token**
3. Name it `Lead Response Webhook`
4. Under **Scopes**, add: `data.records:read`, `data.records:write`
5. Under **Access**, select the base you just created
6. Click **Create token**
7. Copy the token immediately — it will only be shown once
8. Share this token with Topues via the secure method agreed at onboarding

**To find your Base ID:**
1. Open your base in Airtable
2. Look at the URL: `https://airtable.com/appXXXXXXXXXX/...`
3. The part starting with `app` is your Base ID
4. Share this with Topues alongside your API token

---

## Option B — Scripted Setup

Run the automated setup script to create the base and all fields programmatically.

### Prerequisites
- Node.js 18+ installed
- An Airtable account with a Personal Access Token that has `schema.bases:write` and `data.records:write` scopes

### Run the script
```bash
# 1. Copy the example env file
cp .env.example .env

# 2. Fill in your Airtable API key
# Edit .env and set:
#   AIRTABLE_API_KEY=your_token_here

# 3. Run the script
npx ts-node scripts/airtable-setup.ts
```

The script will:
1. Create a new Airtable base named `Lead Response — [timestamp]`
2. Create the `Leads` table with all fields and Stage options
3. Output the Base ID to copy into your `.env` file

See `scripts/airtable-setup.ts` for the full implementation.

---

## Troubleshooting

**"AUTHENTICATION_REQUIRED" error**
Your API token is incorrect or expired. Regenerate it at airtable.com/create/tokens.

**"NOT_FOUND" error on Base ID**
The Base ID in your env vars does not match the base your token has access to. Re-check both.

**Records appear but fields are empty**
The field names in Airtable must match exactly (including capitalisation): `Name`, `Email`, `Phone`, `Message`, `Source`, `Stage`, `Created At`, `Auto Replied At`, `Notes`.
