/**
 * airtable-setup.ts
 *
 * Programmatically creates an Airtable base with the Lead Response schema.
 *
 * Usage:
 *   AIRTABLE_API_KEY=your_token npx ts-node scripts/airtable-setup.ts
 *
 * Requires a Personal Access Token with scopes:
 *   schema.bases:write   (to create base + fields)
 *   data.records:write   (used by the webhook later)
 *
 * The script outputs the new Base ID at the end — copy it into your .env file.
 */

import * as https from "node:https";

const API_KEY = process.env.AIRTABLE_API_KEY;
if (!API_KEY) {
  console.error("Error: AIRTABLE_API_KEY environment variable is not set.");
  process.exit(1);
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function apiRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const options: https.RequestOptions = {
      hostname: "api.airtable.com",
      path,
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let raw = "";
      res.on("data", (chunk: Buffer) => { raw += chunk.toString(); });
      res.on("end", () => {
        try {
          const json = JSON.parse(raw) as T;
          if ((res.statusCode ?? 0) >= 400) {
            reject(new Error(`Airtable API error ${res.statusCode}: ${raw}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`Failed to parse response: ${raw}`));
        }
      });
    });

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// ─── Schema definition ────────────────────────────────────────────────────────

interface CreateBasePayload {
  name: string;
  workspaceId?: string;
  tables: TableDefinition[];
}

interface TableDefinition {
  name: string;
  fields: FieldDefinition[];
}

interface FieldDefinition {
  name: string;
  type: string;
  options?: Record<string, unknown>;
}

function buildSchema(timestamp: string): CreateBasePayload {
  return {
    name: `Lead Response — ${timestamp}`,
    tables: [
      {
        name: "Leads",
        fields: [
          { name: "Email", type: "email" },
          { name: "Phone", type: "phoneNumber" },
          { name: "Message", type: "multilineText" },
          { name: "Source", type: "singleLineText" },
          {
            name: "Stage",
            type: "singleSelect",
            options: {
              choices: [
                { name: "New",          color: "blueLight2" },
                { name: "Auto Replied", color: "cyanLight2" },
                { name: "Engaged",      color: "tealLight2" },
                { name: "Booked",       color: "greenLight2" },
                { name: "Closed",       color: "grayLight2" },
                { name: "Lost",         color: "redLight2" },
              ],
            },
          },
          { name: "Created At",      type: "date", options: { dateFormat: { name: "iso" } } },
          { name: "Auto Replied At", type: "date", options: { dateFormat: { name: "iso" } } },
          { name: "Notes", type: "multilineText" },
        ],
      },
    ],
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface CreateBaseResponse {
  id: string;
  name: string;
  tables?: Array<{ id: string; name: string }>;
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  console.log("Creating Airtable base...");
  const result = await apiRequest<CreateBaseResponse>("POST", "/v0/meta/bases", buildSchema(timestamp));
  console.log("\n\u2713 Base created successfully\n");
  console.log(`Base name: ${result.name}`);
  console.log(`Base ID:   ${result.id}`);
  console.log("\nAdd this to your .env file:");
  console.log(`AIRTABLE_BASE_ID=${result.id}`);
  console.log(`AIRTABLE_TABLE_NAME=Leads`);
  console.log("\nAlso set in your Vercel project dashboard under Environment Variables.");
}

main().catch((err: Error) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
