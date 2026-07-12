import { resolveSchema, type Schema } from "./model";

/**
 * Realistic sample values for the reference. Given a schema (and the field name
 * it sits under), it produces a value a developer would actually send or
 * receive — a real email, integer kobo, an `nbo…` id, an ISO timestamp — not
 * `"string"` placeholders. One generator feeds both the request/response JSON
 * examples and the SDK snippet arguments, so every language shows the same call.
 *
 * Money is ALWAYS integer kobo (manifesto tenet 1): any `*InKobo` field samples
 * a whole-naira amount and never a float.
 */

/** Field-name → sample value. Checked before the type-based fallback. */
function byName(name: string, schema: Schema): unknown | undefined {
  const n = name.toLowerCase();
  if (/inkobo$/.test(name) || /amountinkobo/i.test(name)) return 250_000; // ₦2,500.00
  if (n === "statuscode") return 200;
  if (n === "success") return true;
  if (n === "email") return "ada@example.com";
  if (n === "name") return "Ada Lovelace";
  if (n === "phone") return "+2348012345678";
  if (n === "currency") return "NGN";
  if (n === "country") return "NG";
  // Prefer the canonical case over enum[0] — the enum list is append-ordered, so
  // whichever unit happens to sit first should not decide what every sample shows.
  if (n === "interval") return schema.enum?.includes("month") ? "month" : (schema.enum?.[0] ?? "month");
  if (n === "intervalcount") return 1;
  if (n === "quantity") return 1;
  if (n === "percentoff") return 20;
  if (n === "trialdays" || n === "trialperioddays") return 14;
  if (n === "description") return "Pro plan — monthly";
  if (n === "reference" || n === "idempotencykey") return "sub_2f0a9c";
  if (n === "url") return "https://example.com/webhooks/nomba";
  if (n === "metadata") return { orderId: "ord_8812" };
  if (n === "cursor") return "nbo000000000042cus";
  if (n === "limit") return 20;
  if (/id$/i.test(name)) return sampleId(name);
  if (/_?at$/i.test(name) || schema.format === "date-time") return "2026-07-01T09:30:00Z";
  return undefined;
}

/** An `nbo…{suffix}` id shaped like the platform's real ids. */
function sampleId(name: string): string {
  const map: Record<string, string> = {
    id: "nbo000000000001",
    customerid: "nbo000000000001cus",
    planid: "nbo000000000001pln",
    priceid: "nbo000000000001prc",
    subscriptionid: "nbo000000000001sub",
    invoiceid: "nbo000000000001inv",
    paymentmethodid: "nbo000000000001pm",
    couponid: "nbo000000000001cpn",
    mandateid: "nbo000000000001mnd",
    settlementid: "nbo000000000001stl",
    grantid: "nbo000000000001grn",
    deliveryid: "nbo000000000001dlv",
  };
  const key = name.toLowerCase();
  return map[key] ?? map[key.replace(/id$/, "") + "id"] ?? "nbo000000000001";
}

/**
 * Build a sample value for a schema. `name` (the property key) drives realism;
 * `depth` guards against cyclic/over-deep schemas.
 */
export function sampleValue(schema: Schema | undefined, name = "", depth = 0): unknown {
  const s = resolveSchema(schema);
  if (!s || depth > 4) return null;

  if (s.enum && s.enum.length) return s.enum[0];

  const named = byName(name, s);
  if (named !== undefined) return named;

  switch (s.type) {
    case "string":
      return s.format === "date-time" ? "2026-07-01T09:30:00Z" : "string";
    case "integer":
    case "number":
      return 0;
    case "boolean":
      return false;
    case "array":
      return [sampleValue(s.items, name.replace(/s$/, ""), depth + 1)];
    case "object":
    default: {
      if (!s.properties) return {};
      const out: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(s.properties)) {
        out[key] = sampleValue(propSchema, key, depth + 1);
      }
      return out;
    }
  }
}

/**
 * The request-body example for an operation: only the fields a caller sends,
 * required ones first. Returns `undefined` when there is no body.
 */
export function requestExample(bodySchema: Schema | undefined): Record<string, unknown> | undefined {
  const s = resolveSchema(bodySchema);
  if (!s?.properties) return undefined;
  const required = new Set(s.required ?? []);
  const keys = Object.keys(s.properties).sort((a, b) => {
    const ra = required.has(a) ? 0 : 1;
    const rb = required.has(b) ? 0 : 1;
    return ra - rb;
  });
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = sampleValue(s.properties[key], key, 1);
  return out;
}

/** The success-response example for an operation (its 2xx JSON schema). */
export function responseExample(schema: Schema | undefined): unknown {
  return sampleValue(schema, "", 0);
}
