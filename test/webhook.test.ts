import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock fetch globally ─────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Use real Web Crypto (Node 20+ has globalThis.crypto.subtle natively) ──

const WEBHOOK_SECRET = "test-secret-abc123";

async function makeSignature(body: string): Promise<string> {
  const { createHmac } = await import("node:crypto");
  const mac = createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  return `sha256=${mac}`;
}

function makeEnv(overrides: Record<string, string> = {}): void {
  const defaults: Record<string, string> = {
    WEBHOOK_SECRET,
    AIRTABLE_API_KEY: "airtable-key",
    AIRTABLE_BASE_ID: "appTestBase123",
    AIRTABLE_TABLE_NAME: "Leads",
    RESEND_API_KEY: "resend-key",
    RESEND_AUDIENCE_ID: "aud_test123",
    RESEND_FROM_EMAIL: "hello@testclient.com",
    RESEND_FROM_NAME: "Jane from Test Co",
    TWILIO_ENABLED: "false",
    TWILIO_ACCOUNT_SID: "",
    TWILIO_AUTH_TOKEN: "",
    TWILIO_FROM_NUMBER: "",
    TELEGRAM_BOT_TOKEN: "bot_token_test",
    TELEGRAM_CHAT_ID: "9876543210",
    ...overrides,
  };
  for (const [k, v] of Object.entries(defaults)) process.env[k] = v;
}

function okResponse(): Response {
  return new Response(JSON.stringify({ id: "rec123" }), { status: 200 });
}

async function callHandler(body: unknown, overrideHeaders: Record<string, string> = {}): Promise<Response> {
  const raw = JSON.stringify(body);
  const sig = await makeSignature(raw);
  const mod = await import("../api/webhook.js");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("https://example.com/api/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-signature": sig, "x-forwarded-for": "1.2.3.4", ...overrideHeaders },
    body: raw,
  });
  return mod.default(req);
}

// ─── Standard form tests ────────────────────────────────────────────────────

describe("Standard form payload", () => {
  beforeEach(() => { makeEnv(); mockFetch.mockResolvedValue(okResponse()); });
  afterEach(() => { vi.clearAllMocks(); });

  it("accepts a valid standard form payload and returns 200", async () => {
    const res = await callHandler({ name: "Alice Smith", email: "alice@example.com", phone: "+61412345678", message: "Hello", source: "Website Form" });
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
  });

  it("calls Airtable with correct field mapping", async () => {
    await callHandler({ name: "Alice Smith", email: "alice@example.com", phone: "+61412345678", message: "Hello", source: "Website Form" });
    const call = mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("airtable.com"));
    expect(call).toBeDefined();
    const body = JSON.parse(String((call![1] as RequestInit).body));
    expect(body.fields.Name).toBe("Alice Smith");
    expect(body.fields.Email).toBe("alice@example.com");
    expect(body.fields.Stage).toBe("New");
  });

  it("calls Resend audience API", async () => {
    await callHandler({ name: "Alice Smith", email: "alice@example.com", source: "Website Form" });
    const call = mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("resend.com"));
    expect(call).toBeDefined();
    const body = JSON.parse(String((call![1] as RequestInit).body));
    expect(body.email).toBe("alice@example.com");
    expect(body.first_name).toBe("Alice");
  });

  it("calls Telegram notification with correct text", async () => {
    await callHandler({ name: "Alice Smith", email: "alice@example.com", phone: "+61412345678", source: "Website Form" });
    const call = mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("telegram.org"));
    expect(call).toBeDefined();
    const body = JSON.parse(String((call![1] as RequestInit).body));
    expect(body.text).toContain("Alice Smith");
    expect(body.text).toContain("alice@example.com");
    expect(body.text).toContain("Website Form");
    expect(body.chat_id).toBe("9876543210");
  });

  it("does NOT call Twilio when TWILIO_ENABLED=false", async () => {
    await callHandler({ name: "Alice Smith", email: "alice@example.com", phone: "+61412345678", source: "Website Form" });
    expect(mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("twilio.com"))).toBeUndefined();
  });

  it("calls Twilio when TWILIO_ENABLED=true and phone is present", async () => {
    makeEnv({ TWILIO_ENABLED: "true", TWILIO_ACCOUNT_SID: "AC123", TWILIO_AUTH_TOKEN: "auth123", TWILIO_FROM_NUMBER: "+611234" });
    await callHandler({ name: "Bob Jones", email: "bob@example.com", phone: "+61498765432", source: "Website Form" });
    expect(mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("twilio.com"))).toBeDefined();
  });

  it("returns 401 on invalid signature", async () => {
    makeEnv();
    const { NextRequest } = await import("next/server");
    const mod = await import("../api/webhook.js");
    const req = new NextRequest("https://example.com/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-webhook-signature": "sha256=invalidsignature", "x-forwarded-for": "1.2.3.5" },
      body: JSON.stringify({ name: "X", email: "x@x.com" }),
    });
    expect((await mod.default(req)).status).toBe(401);
  });
});

// ─── Typeform payload tests ───────────────────────────────────────────────────

describe("Typeform payload", () => {
  beforeEach(() => { makeEnv(); mockFetch.mockResolvedValue(okResponse()); });
  afterEach(() => { vi.clearAllMocks(); });

  it("correctly parses Typeform payload and writes to Airtable", async () => {
    const payload = {
      form_response: {
        form_id: "abc123",
        answers: [
          { field: { id: "f1" }, type: "text", text: "Carol White" },
          { field: { id: "f2" }, type: "email", email: "carol@example.com" },
          { field: { id: "f3" }, type: "phone_number", phone_number: "+61455111222" },
          { field: { id: "f4" }, type: "long_text", text: "I need a new website" },
        ],
      },
    };
    const res = await callHandler(payload);
    expect(res.status).toBe(200);
    const call = mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("airtable.com"));
    const body = JSON.parse(String((call![1] as RequestInit).body));
    expect(body.fields.Name).toBe("Carol White");
    expect(body.fields.Email).toBe("carol@example.com");
    expect(body.fields.Source).toBe("Typeform");
  });

  it("sends Telegram notification with Typeform source label", async () => {
    const payload = { form_response: { answers: [
      { field: { id: "f1" }, type: "text", text: "Carol White" },
      { field: { id: "f2" }, type: "email", email: "carol@example.com" },
    ]}};
    await callHandler(payload);
    const call = mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("telegram.org"));
    expect(JSON.parse(String((call![1] as RequestInit).body)).text).toContain("Typeform");
  });
});

// ─── Facebook Lead Ad payload tests ──────────────────────────────────────────────

describe("Facebook Lead Ad payload", () => {
  beforeEach(() => { makeEnv(); mockFetch.mockResolvedValue(okResponse()); });
  afterEach(() => { vi.clearAllMocks(); });

  it("correctly parses Facebook Lead Ad payload and writes to Airtable", async () => {
    const payload = {
      object: "page",
      entry: [{ id: "page123", changes: [{ value: { leadgen_id: "lead456", field_data: [
        { name: "full_name", values: ["Dave Brown"] },
        { name: "email", values: ["dave@example.com"] },
        { name: "phone_number", values: ["+61433222111"] },
        { name: "message", values: ["Interested in your services"] },
      ]}}]}],
    };
    const res = await callHandler(payload);
    expect(res.status).toBe(200);
    const call = mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("airtable.com"));
    const body = JSON.parse(String((call![1] as RequestInit).body));
    expect(body.fields.Name).toBe("Dave Brown");
    expect(body.fields.Email).toBe("dave@example.com");
    expect(body.fields.Source).toBe("Facebook Lead Ad");
  });

  it("sends Telegram notification with Facebook source label", async () => {
    const payload = { entry: [{ changes: [{ value: { field_data: [
      { name: "full_name", values: ["Dave Brown"] },
      { name: "email", values: ["dave@example.com"] },
    ]}}]}]};
    await callHandler(payload);
    const call = mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("telegram.org"));
    expect(JSON.parse(String((call![1] as RequestInit).body)).text).toContain("Facebook Lead Ad");
  });
});

// ─── Google Ads Lead Form payload tests ──────────────────────────────────────────

describe("Google Ads Lead Form payload", () => {
  beforeEach(() => { makeEnv(); mockFetch.mockResolvedValue(okResponse()); });
  afterEach(() => { vi.clearAllMocks(); });

  it("correctly parses Google Ads lead form payload and writes to Airtable", async () => {
    const payload = {
      lead_id: "gad_lead_789",
      user_column_data: [
        { column_id: "FIRST_NAME", string_value: "Eve" },
        { column_id: "LAST_NAME", string_value: "Chen" },
        { column_id: "EMAIL", string_value: "eve@example.com" },
        { column_id: "PHONE_NUMBER", string_value: "+61422333444" },
      ],
    };
    const res = await callHandler(payload);
    expect(res.status).toBe(200);
    const call = mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("airtable.com"));
    const body = JSON.parse(String((call![1] as RequestInit).body));
    expect(body.fields.Name).toBe("Eve Chen");
    expect(body.fields.Email).toBe("eve@example.com");
    expect(body.fields.Source).toBe("Google Ads Lead Form");
  });

  it("sends Telegram notification with Google Ads source label", async () => {
    const payload = { user_column_data: [
      { column_id: "FIRST_NAME", string_value: "Eve" },
      { column_id: "LAST_NAME", string_value: "Chen" },
      { column_id: "EMAIL", string_value: "eve@example.com" },
    ]};
    await callHandler(payload);
    const call = mockFetch.mock.calls.find((c: unknown[]) => String(c[0]).includes("telegram.org"));
    expect(JSON.parse(String((call![1] as RequestInit).body)).text).toContain("Google Ads Lead Form");
  });
});
