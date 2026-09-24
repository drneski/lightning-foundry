# 0003. Public event ids are random UUIDv4

**Status:** accepted, 2026-09-23

## Decision

Every public event gets a fresh, random UUIDv4 from the export. It never reuses the internal
event's id, and the public schema accepts version 4 only.

## Alternatives

- **Reuse the internal ULID or UUIDv7**, which is unique and sortable.
- **A new ULID or UUIDv7** for each public event.
- **A per-node counter.**

## Why

ULIDs and UUIDv7s embed a millisecond timestamp in their leading bits. On a public event that
would publish the exact time beside a bucket field that exists to hide it, undoing the
bucketing — the hourly bucketing of rebalances included. Reusing the internal id would also
link the two streams. A counter would duplicate `seq` and collide across restarts.

## Consequences

- Public ids carry no order. Consumers order by `seq`, never by `id` or `bucket`.
- The schema can check the version, not the randomness. Generating ids at random is the
  export's job, and the contract tests confirm that no public example reuses an internal id.
