#!/usr/bin/env node
// Contract tests for the event schemas. No dependencies by design — see AGENTS.md.
// Run: node tests/contract.test.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const json = (p) => JSON.parse(read(p));
const lines = (p) => read(p).trim().split("\n").map((l, i) => {
  try { return JSON.parse(l); } catch (e) { throw new Error(`${p} line ${i + 1}: ${e.message}`); }
});

let failed = 0;
const check = (name, ok, detail = "") => {
  if (ok) console.log(`PASS ${name}`);
  else { failed++; console.log(`FAIL ${name}${detail ? ` · ${detail}` : ""}`); }
};

const internalSchema = json("schemas/foundry-event.v1.schema.json");
const publicSchema = json("schemas/foundry-public-event.v1.schema.json");
const internal = lines("examples/events.jsonl");
const pub = lines("examples/public-events.jsonl");

// Walk every key and every primitive value in a nested object
const walk = (node, visit, path = []) => {
  if (Array.isArray(node)) return node.forEach((v, i) => walk(v, visit, [...path, String(i)]));
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) { visit(k, v, [...path, k]); walk(v, visit, [...path, k]); }
    return;
  }
};

// ---- a validator for exactly the JSON Schema keywords these schemas use -------
// A few lines instead of a dependency. It throws on any keyword it does not implement,
// so a schema edit can never be silently half-checked. `format` is asserted, which
// the specification leaves optional.
const ANNOTATIONS = new Set(["$schema", "$id", "$defs", "title", "description", "if", "then"]);
const TYPES = {
  object: (v) => v !== null && typeof v === "object" && !Array.isArray(v),
  string: (v) => typeof v === "string",
  integer: (v) => Number.isInteger(v),
  number: (v) => typeof v === "number",
  boolean: (v) => typeof v === "boolean",
};
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const validate = (schema, value, at = "", top = schema) => {
  const errors = [];
  const here = at || "/";
  for (const [k, s] of Object.entries(schema)) {
    if (ANNOTATIONS.has(k)) continue;
    switch (k) {
      case "$ref":
        if (!s.startsWith("#/")) throw new Error(`validator resolves local refs only: ${s}`);
        errors.push(...validate(s.slice(2).split("/").reduce((o, p) => o[p], top), value, at, top));
        break;
      case "type":
        if (!TYPES[s]) throw new Error(`validator does not implement type "${s}"`);
        if (!TYPES[s](value)) errors.push(`${here} is not ${s}`);
        break;
      case "const": if (value !== s) errors.push(`${here} is not ${JSON.stringify(s)}`); break;
      case "enum": if (!s.includes(value)) errors.push(`${here} ${JSON.stringify(value)} is not allowed`); break;
      case "pattern": if (typeof value === "string" && !new RegExp(s, "u").test(value)) errors.push(`${here} does not match ${s}`); break;
      case "format":
        if (s !== "date-time") throw new Error(`validator does not implement format "${s}"`);
        if (typeof value === "string" && !(DATE_TIME.test(value) && !Number.isNaN(Date.parse(value)))) errors.push(`${here} is not a date-time`);
        break;
      case "minimum": if (typeof value === "number" && value < s) errors.push(`${here} is below ${s}`); break;
      case "maximum": if (typeof value === "number" && value > s) errors.push(`${here} is above ${s}`); break;
      case "required":
        if (TYPES.object(value)) for (const r of s) if (!(r in value)) errors.push(`${at}/${r} is required`);
        break;
      case "properties":
        if (TYPES.object(value)) for (const [p, ps] of Object.entries(s)) if (p in value) errors.push(...validate(ps, value[p], `${at}/${p}`, top));
        break;
      case "additionalProperties":
        if (typeof s !== "boolean") throw new Error(`validator implements boolean additionalProperties only, at ${here}`);
        if (!s && TYPES.object(value)) for (const p of Object.keys(value)) if (!(p in (schema.properties ?? {}))) errors.push(`${at}/${p} is not allowed`);
        break;
      case "allOf": for (const sub of s) errors.push(...validate(sub, value, at, top)); break;
      case "anyOf": if (!s.some((sub) => validate(sub, value, at, top).length === 0)) errors.push(`${here} matches none of anyOf`); break;
      case "not": if (validate(s, value, at, top).length === 0) errors.push(`${here} has a forbidden shape`); break;
      default: throw new Error(`validator does not implement "${k}"`);
    }
  }
  if (schema.if && schema.then && validate(schema.if, value, at, top).length === 0) errors.push(...validate(schema.then, value, at, top));
  return errors;
};
const invalid = (schema, rows) => rows.flatMap((e, i) => validate(schema, e).map((m) => `line ${i + 1}: ${m}`));

// seq is assigned per node and only ever grows; gaps are allowed and mean a filtered or missed event
const seqProblems = (rows) => {
  const last = new Map();
  return rows.flatMap((e) => {
    const broken = last.has(e.node) && e.seq <= last.get(e.node) ? [`${e.node} ${last.get(e.node)} -> ${e.seq}`] : [];
    last.set(e.node, e.seq);
    return broken;
  });
};

// ---- the internal contract -----------------------------------------------------

// The envelope table in docs/event-model.md is the contract as written, and the schema's
// required list is the contract as enforced. They must name the same fields.
const envelope = read("docs/event-model.md").split(/^## /m).find((s) => s.startsWith("Envelope")) ?? "";
const documented = [...envelope.matchAll(/^\| `([a-z_]+)` \|/gm)].map((m) => m[1]);
const drift = [
  ...documented.filter((f) => !internalSchema.required.includes(f)).map((f) => `documented but not required: ${f}`),
  ...internalSchema.required.filter((f) => !documented.includes(f)).map((f) => `required but not documented: ${f}`),
];
check("internal schema: requires exactly the envelope docs/event-model.md describes",
  documented.length > 0 && drift.length === 0, drift.join(", ") || "no envelope table found");

const internalInvalid = invalid(internalSchema, internal);
check("internal examples: every event validates against foundry-event.v1", internalInvalid.length === 0, internalInvalid.join("; "));

const internalSeq = seqProblems(internal);
check("internal examples: seq is monotonic per node", internalSeq.length === 0, internalSeq.join(", "));

// LND emits no liquidity or economics event; anything claiming otherwise is a bug.
const alwaysDerived = internal.filter((e) => /^(liquidity\.|economics\.)/.test(e.type) && e.origin !== "derived");
check("internal examples: liquidity and economics events are always derived", alwaysDerived.length === 0,
  alwaysDerived.map((e) => `${e.type} claimed ${e.origin}`).join(", "));

const simClaimsObserved = internal.filter((e) => e.source === "simulation" && e.origin === "observed");
check("internal examples: simulated events never claim to be observed", simClaimsObserved.length === 0);

// The measures in docs/economics.md are identities, and a snapshot that breaks one is wrong
// however plausible its numbers look. Return on capital is checked to its reported precision.
const YEAR_SECONDS = 365 * 86400;
const snapshots = internal.filter((e) => e.type === "economics.snapshot");
const unbalanced = snapshots.flatMap(({ seq, payload: p }) => {
  const wrong = [];
  if (p.operating_margin_msat !== p.routing_revenue_msat - p.rebalance_cost_msat) wrong.push("operating margin");
  if ("complete_profitability_msat" in p && p.complete_profitability_msat !== p.operating_margin_msat - p.lifecycle_cost_msat) wrong.push("complete profitability");
  if ("return_on_capital_annualized" in p) {
    const roc = (p.complete_profitability_msat / 1000 / p.capital_committed_sat) * (YEAR_SECONDS / p.window_seconds);
    if (Math.abs(roc - p.return_on_capital_annualized) > 0.00005) wrong.push(`return on capital (${roc.toFixed(6)})`);
  }
  return wrong.map((w) => `seq ${seq}: ${w}`);
});
check("internal examples: economics snapshots add up as docs/economics.md defines them",
  snapshots.length > 0 && unbalanced.length === 0, unbalanced.join(", ") || "no snapshot to check");

// ---- the public feed cannot leak ---------------------------------------------

// These names must not exist anywhere in the public schema. The point of a separate
// schema is that a forgotten redaction cannot leak a field the schema cannot express.
const FORBIDDEN_KEYS = [
  "channel_id", "in_channel_id", "out_channel_id", "from_channel_id", "to_channel_id",
  "peer_pubkey", "pubkey", "channel_point", "address",
  "amount_msat", "fee_msat", "max_fee_msat", "fee_paid_msat",
  "capacity_sat", "settled_balance_sat", "capital_committed_sat",
  "routing_revenue_msat", "rebalance_cost_msat", "operating_margin_msat",
  "local_ratio", "threshold_ratio", "direction", "time", "emitted"
];
const leakedKeys = [];
walk(publicSchema, (k, _v, path) => {
  // only property *names* count, not prose inside descriptions
  if (path.at(-2) === "properties" && FORBIDDEN_KEYS.includes(k)) leakedKeys.push(path.join("."));
});
check("public schema: declares no field that could carry identity, balance or exact timing",
  leakedKeys.length === 0, leakedKeys.join(", "));

// Liquidity state is what probing attacks are for; it must never reach a public feed.
const publicTypes = publicSchema.properties.type.enum;
const leakedTypes = publicTypes.filter((t) => /^(liquidity\.|economics\.)/.test(t));
check("public schema: publishes no liquidity or economics event type",
  leakedTypes.length === 0, leakedTypes.join(", "));

// Unknown fields must be impossible, or the schema stops being a guarantee.
const openObjects = [];
walk(publicSchema, (k, v, path) => {
  if (k === "type" && v === "object" && path.length > 1) {
    const parent = path.slice(0, -1).reduce((o, p) => o?.[p], publicSchema);
    if (parent && parent.additionalProperties !== false) openObjects.push(path.slice(0, -1).join("."));
  }
});
check("public schema: every object is closed to additional properties", openObjects.length === 0, openObjects.join(", "));

// Time-ordered ids are right internally and a leak in public: ULID and UUIDv7 both embed a
// millisecond timestamp, which would publish the exact event time beside the bucket.
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const publicIdPattern = publicSchema.properties.id.pattern;
check("public schema: ids are random, never time-ordered",
  new RegExp(publicIdPattern).test("123e4567-e89b-42d3-a456-426614174000")
    && !new RegExp(publicIdPattern).test("01JBQ8Z4T0K9X2M7NPQR3VWXYZ")
    && !new RegExp(publicIdPattern).test("0192f1c4-7b2a-7c3d-8e4f-5a6b7c8d9e0f"),
  publicIdPattern);

// The schema, not the examples, is the guarantee, so feed it events it must refuse. Each
// case changes one thing about an event the schema accepts.
const accepted = (cases) => Object.entries(cases).filter(([, e]) => validate(publicSchema, e).length === 0).map(([name]) => name);
const refusal = (control, cases) => {
  const errors = validate(publicSchema, control);
  if (errors.length) return `the valid control was refused: ${errors.join("; ")}`;
  const let_through = accepted(cases);
  return let_through.length ? `accepted ${let_through.join(", ")}` : "";
};
const failure = {
  schema: "foundry.public.event.v1", id: "2f1c6d8e-4b7a-4c3e-9d2f-8a6b5c4d3e2f", seq: 1,
  bucket: "2026-04-18T17:44:00Z", node: "ooga", origin: "observed", stream: "live",
  type: "forward.failed", payload: { scale: "large", count: 1, slot: "k7" },
};
const withPayload = (event, extra) => ({ ...event, payload: { ...event.payload, ...extra } });
const leaks = refusal(failure, {
  "a channel id": withPayload(failure, { channel_id: "901234567890123456" }),
  "a balance": withPayload(failure, { local_ratio: 0.06 }),
  "an exact amount": withPayload(failure, { amount_msat: 2200000000 }),
  "an exact time": { ...failure, time: "2026-04-18T17:44:05Z" },
  "a liquidity event": { ...failure, type: "liquidity.low" },
});
check("public schema: refuses a channel id, a balance, an exact amount, an exact time and a liquidity event",
  leaks === "", leaks);

// Rebalances are published, but a rebalance happens because a channel was low, so the schema
// itself must refuse to name the line, report a success rate, or time it finer than the hour.
const REBALANCE = ["rebalance.succeeded", "rebalance.failed"];
const rebalance = { ...failure, type: "rebalance.succeeded", bucket: "2026-04-18T17:00:00Z", payload: { scale: "large", count: 1 } };
const rebalanceLeaks = refusal(rebalance, {
  "a line": withPayload(rebalance, { slot: "k7" }),
  "a success rate": withPayload(rebalance, { success_ratio: 0.5 }),
  "a minute bucket": { ...rebalance, bucket: "2026-04-18T17:44:00Z" },
  "a failed rebalance with a line": withPayload({ ...rebalance, type: "rebalance.failed" }, { slot: "k7" }),
});
check("public schema: a rebalance cannot name a line, carry a success rate, or be timed finer than the hour",
  rebalanceLeaks === "", rebalanceLeaks);

// ---- the public examples -------------------------------------------------------

const publicInvalid = invalid(publicSchema, pub);
check("public examples: every event validates against foundry-public-event.v1", publicInvalid.length === 0, publicInvalid.join("; "));

const publicSeq = seqProblems(pub);
check("public examples: seq is monotonic per node", publicSeq.length === 0, publicSeq.join(", "));

// Nothing identifying may appear in any value, including fields that look harmless.
const PUBKEY = /^0[23][0-9a-f]{64}$/;
const CHANNEL_POINT = /^[0-9a-f]{64}:[0-9]+$/;
const CHANNEL_ID = /^[0-9]{15,20}$/;
const leakedValues = [];
for (const [i, e] of pub.entries()) {
  walk(e, (k, v, path) => {
    if (typeof v !== "string") return;
    if (PUBKEY.test(v) || CHANNEL_POINT.test(v) || CHANNEL_ID.test(v)) leakedValues.push(`line ${i + 1}: ${path.join(".")}`);
  });
}
check("public examples: carry no pubkey, channel point or channel id", leakedValues.length === 0, leakedValues.join(", "));

// Buckets are floored to the minute; exact timing plus channel state is what an attacker wants.
const unbucketed = pub.filter((e) => !/:\d{2}:00(\.0+)?Z$/.test(e.bucket)).map((e) => e.bucket);
check("public examples: timestamps are bucketed, not exact", unbucketed.length === 0, unbucketed.join(", "));

const internalIds = new Set(internal.map((e) => e.id));
const linked = pub.filter((e) => internalIds.has(e.id)).map((e) => e.id);
check("public examples: no id is shared with the internal stream", linked.length === 0, linked.join(", "));

// A rebalance labeled "sometime this hour" but emitted the instant it happens is timed
// exactly by its position in the stream. It must be held and released after everything
// else from its hour, so seq order reveals nothing finer than the bucket.
const hourOf = (b) => b.slice(0, 13);
const rebalances = pub.filter((e) => REBALANCE.includes(e.type));
const early = rebalances.flatMap((r) => {
  const later = pub.filter((e) => !REBALANCE.includes(e.type) && hourOf(e.bucket) === hourOf(r.bucket) && e.seq > r.seq);
  return later.length ? [`seq ${r.seq} before seq ${later.map((e) => e.seq).join(",")} of the same hour`] : [];
});
check("public examples: rebalances are released after every other event from their hour",
  rebalances.length > 0 && early.length === 0, rebalances.length ? early.join("; ") : "no rebalance example to check");

// A slot labels a line for one UTC day. The examples never reuse a label on a second day,
// so none can be misread as an identity that persists.
const slotDays = new Map();
for (const e of pub) {
  const slot = e.payload?.slot;
  if (slot) slotDays.set(slot, (slotDays.get(slot) ?? new Set()).add(e.bucket.slice(0, 10)));
}
const persisted = [...slotDays].filter(([, days]) => days.size > 1).map(([slot, days]) => `${slot} on ${[...days].join(", ")}`);
check("public examples: no slot label appears on two UTC days",
  slotDays.size > 0 && persisted.length === 0, persisted.join("; ") || "no slot to check");

console.log(`\n${failed ? `${failed} failed` : "all checks passed"}`);
process.exit(failed ? 1 : 0);
