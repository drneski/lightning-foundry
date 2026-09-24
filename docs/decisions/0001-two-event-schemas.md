# 0001. Two event schemas, not one with a redaction filter

**Status:** accepted, 2026-09-23

## Decision

Foundry has two event schemas. The internal one, `foundry.event.v1`, may carry channel ids,
pubkeys and balances, and never leaves the operator's machine. The public one,
`foundry.public.event.v1`, is a separate document with no field capable of holding any of
them, closed to additional properties at every level.

## Alternatives

- **One schema, redacted on export.** A filter strips sensitive fields before publishing.
- **One schema and no public feed.** Nothing is published; visualizations run on simulated data.

## Why

A redaction filter leaks the one field somebody forgot to add to it, and it fails silently:
nothing breaks when a new sensitive field ships unredacted. A schema that cannot express a
channel id cannot leak one, and a contract test can prove that against the schema itself.
Publishing nothing would give up the Lightning Factory and the community loop it feeds, and
showing a real node is the point of both.

## Consequences

- Export is a translation between schemas, written deliberately for each public event type,
  never a filter.
- A visualization cannot show which channel is running dry. That limit is intended.
- Every change to the public schema is a new version and a new disclosure, reviewed as one —
  see [`event-model.md`](../event-model.md#versioning).
