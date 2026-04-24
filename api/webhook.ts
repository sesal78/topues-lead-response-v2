import type { NextRequest } from "next/server";

export const runtime = "edge";

interface NormalisedLead {
  name: string;
  email: string;
  phone: string;
  message: string;
  source: string;
}

// ─── Rate limiter (in-memory, per-instance) ───────────────────────────────────

const rateMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

// ─── HMAC verification ────────────────────────────────────────────────────────

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = "sha256=" + Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Source format parsers ────────────────────────────────────────────────────

function parseStandardForm(body: Record<string, unknown>): NormalisedLead {
  return {
    name: String(body.name ?? ""),
    email: String(body.email ?? ""),
    phone: String(body.phone ?? ""),
    message: String(body.message ?? ""),
    source: String(body.source ?? "Website Form"),
  };
}

function parseTypeform(body: Record<string, unknown>): NormalisedLead {
  const response = (body.form_response as Record<string, unknown>) ?? {};
  const answers = (response.answers as Array<Record<string, unknown>>) ?? [];

  const get = (types: string[]): string => {
    for (const a of answers) {
      const type = String(a.type ?? "");
      if (types.includes(type)) {
        if (type === "email") return String(a.email ?? "");
        if (type === "phone_number") return String(a.phone_number ?? "");
        if (type === "text" || type === "short_text" || type === "long_text") return String(a.text ?? "");
      }
    }
    return "";
  };

  return {
    name: get(["text", "short_text"]),
    email: get(["email"]),
    phone: get(["phone_number"]),
    message: get(["long_text", "text"]),
    source: "Typeform",
  };
}

function parseFacebookLeadAd(body: Record<string, unknown>): NormalisedLead {
  const entries = (body.entry as Array<Record<string, unknown>>) ?? [];
  const changes = (entries[0]?.changes as Array<Record<string, unknown>>) ?? [];
  const value = (changes[0]?.value as Record<string, unknown>) ?? {};
  const fieldData = (value.field_data as Array<Record<string, unknown>>) ?? [];

  const get = (names: string[]): string => {
    for (const field of fieldData) {
      if (names.includes(String(field.name ?? ""))) {
        const values = (field.values as string[]) ?? [];
        return values[0] ?? "";
      }
    }
    return "";
  };

  return {
    name: get(["full_name", "name", "first_name"]),
    email: get(["email"]),
    phone: get(["phone_number", "phone"]),
    message: get(["message", "comments", "note"]),
    source: "Facebook Lead Ad",
  };
}

function parseGoogleAdsLead(body: Record<string, unknown>): NormalisedLead {
  const userData = (body.user_column_data as Array<Record<string, unknown>>) ?? [];

  const get = (columns: string[]): string => {
    for (const col of userData) {
      if (columns.includes(String(col.column_id ?? ""))) return String(col.string_value ?? "");
    }
    return "";
  };

  return {
    name: [get(["FIRST_NAME"]), get(["LAST_NAME"])].filter(Boolean).join(" "),
    email: get(["EMAIL"]),
    phone: get(["PHONE_NUMBER"]),
    message: get(["ADDITIONAL_PAYLOAD", "message"]),
    source: "Google Ads Lead Form",
  };
}

function detectAndParse(body: Record<string, unknown>): NormalisedLead {
  if (body.form_response) return parseTypeform(body);
  if (body.entry && Array.isArray(body.entry)) return parseFacebookLeadAd(body);
  if (body.user_column_data) return parseGoogleAdsLead(body);
  return parseStandardForm(body);
}

// ─── Downstream integrations ──────────────────────────────────────────────────

async function writeToAirtable(lead: NormalisedLead, env: Record<string, string>): Promise<void> {
  const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${encodeURIComponent(env.AIRTABLE_TABLE_NAME ?? "Leads")}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.AIRTABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fields: {
        Name: lead.name, Email: lead.email, Phone: lead.phone,
        Message: lead.message, Source: lead.source, Stage: "New",
        "Created At": new Date().toISOString().split("T")[0],
      },
    }),
  });
  if (!res.ok) throw new Error(`Airtable write failed: ${res.status} ${await res.text()}`);
}

async function addToResendAudience(lead: NormalisedLead, env: Record<string, string>): Promise<void> {
  const url = `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: lead.email,
      first_name: lead.name.split(" ")[0] ?? lead.name,
      last_name: lead.name.split(" ").slice(1).join(" ") || undefined,
      unsubscribed: false,
    }),
  });
  if (!res.ok) throw new Error(`Resend audience add failed: ${res.status} ${await res.text()}`);
}

async function sendTwilioSms(lead: NormalisedLead, env: Record<string, string>): Promise<void> {
  if (env.TWILIO_ENABLED !== "true" || !lead.phone) return;
  const body = `Hi ${lead.name.split(" ")[0] ?? lead.name}, thanks for reaching out to ${env.RESEND_FROM_NAME ?? "us"}. We'll be in touch shortly.`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: lead.phone, From: env.TWILIO_FROM_NUMBER, Body: body }).toString(),
  });
  if (!res.ok) throw new Error(`Twilio SMS failed: ${res.status} ${await res.text()}`);
}

async function sendTelegramNotification(lead: NormalisedLead, env: Record<string, string>): Promise<void> {
  const text = `New lead: ${lead.name} | ${lead.email} | ${lead.phone || "no phone"} | from ${lead.source}`;
  const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text }),
  });
  if (!res.ok) throw new Error(`Telegram notification failed: ${res.status} ${await res.text()}`);
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  if (isRateLimited(ip)) return new Response("Too Many Requests", { status: 429 });

  const rawBody = await req.text();
  const signature = req.headers.get("x-webhook-signature") ?? "";
  const secret = process.env.WEBHOOK_SECRET ?? "";
  if (!secret) return new Response("Server misconfigured: missing WEBHOOK_SECRET", { status: 500 });

  const valid = await verifySignature(rawBody, signature, secret);
  if (!valid) return new Response("Unauthorized", { status: 401 });

  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody); }
  catch { return new Response("Bad Request: invalid JSON", { status: 400 }); }

  const lead = detectAndParse(body);
  if (!lead.email || !lead.name) return new Response("Bad Request: name and email are required", { status: 400 });

  const env: Record<string, string> = {
    AIRTABLE_API_KEY:   process.env.AIRTABLE_API_KEY ?? "",
    AIRTABLE_BASE_ID:   process.env.AIRTABLE_BASE_ID ?? "",
    AIRTABLE_TABLE_NAME: process.env.AIRTABLE_TABLE_NAME ?? "Leads",
    RESEND_API_KEY:     process.env.RESEND_API_KEY ?? "",
    RESEND_AUDIENCE_ID: process.env.RESEND_AUDIENCE_ID ?? "",
    RESEND_FROM_NAME:   process.env.RESEND_FROM_NAME ?? "",
    RESEND_FROM_EMAIL:  process.env.RESEND_FROM_EMAIL ?? "",
    TWILIO_ENABLED:     process.env.TWILIO_ENABLED ?? "false",
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID ?? "",
    TWILIO_AUTH_TOKEN:  process.env.TWILIO_AUTH_TOKEN ?? "",
    TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? "",
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
    TELEGRAM_CHAT_ID:   process.env.TELEGRAM_CHAT_ID ?? "",
  };

  const results = await Promise.allSettled([
    writeToAirtable(lead, env),
    addToResendAudience(lead, env),
    sendTwilioSms(lead, env),
    sendTelegramNotification(lead, env),
  ]);

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === "rejected")
    .map((r) => String(r.reason));
  if (errors.length > 0) console.error("Integration errors:", errors.join("; "));

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
