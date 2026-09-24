# Examples

One channel's life on a routing node, told twice: once as the node's own store records it, and
once as the public feed publishes it. Everything here is synthetic. The pubkey, channel point
and channel ids are made up in ways that are obvious at a glance (`02aaaa…`, `a1a1…:0`,
`901234567890123456`), and no node produced these lines.

| File | Schema | Who sees it |
|---|---|---|
| `events.jsonl` | [`foundry.event.v1`](../schemas/foundry-event.v1.schema.json) | the operator's machine, and nothing else |
| `public-events.jsonl` | [`foundry.public.event.v1`](../schemas/foundry-public-event.v1.schema.json) | anyone, including the Lightning Factory |

## The story

| When (UTC) | Internal stream | Public stream |
|---|---|---|
| 2026-03-23 14:00 | `node.ready`; the future peer reconnects, `peer.connected` | `node.ready`, `peer.count.changed` |
| 14:01 | `channel.opening`: 5,000,000 sats, opened by this node | `channel.opening`, `large`, slot `a3` |
| 14:33 | `channel.active` | `channel.active`, `large`, slot `a3` |
| 2026-04-18 15:02 | `forward.settled`: 250,000 sats out, 125 sats in fees | `forward.settled`, `medium`, slot `k7` |
| 17:44 | `liquidity.low` at 6% outbound; a 2,200,000-sat forward fails for want of it | `forward.failed`, `large`, slot `k7`, no reason given |
| 17:45 | `rebalance.started`, `rebalance.succeeded`: 1,500,000 sats in, for 522 sats | held until the hour closes |
| 17:46 | `liquidity.recovered` at 36% | nothing |
| 18:00 | | `rebalance.succeeded`, `large`, bucket 17:00, no slot; then `activity.summary` for 17:00–18:00 |
| 2026-09-19 08:47 | `channel.closing`, cooperative | `channel.closing`, `large`, slot `p2` |
| 09:12 | `channel.closed`, then `economics.snapshot` for the channel's whole life | `channel.closed`, `large`, slot `p2` |

**Why `seq` has gaps.** These are excerpts. A busy node records many events between these
lines — other channels' forwards, the rest of its peers reconnecting after the restart — and
each stream numbers every one of its own. In a live stream a gap means an event was filtered out
or missed; here it means the line was left out. The two streams count independently, so their
`seq` values never correspond.

**What the public stream leaves out.** Channel ids, pubkeys, balances, exact amounts and times,
the failure reason, both liquidity events, the rebalance's line and fee, and the economics. Its
ids are fresh random UUIDv4s rather than the internal ULIDs. The slot changes every UTC day, so
one line is `a3`, `k7` and `p2` on its three days.

**What it still gives away.** A failure on `k7` at 17:44 and a rebalance in the 17:00 bucket
point at the same line. That inference is risk 3 in
[`docs/integrations/oogabooga.md`](../docs/integrations/oogabooga.md), accepted deliberately.

**The economics** are the worked example in [`docs/economics.md`](../docs/economics.md):
42,000 sats of routing revenue, less 11,500 of rebalance cost and 8,000 of on-chain fees,
leaves 22,500 sats over just under six months on 5,000,000 committed — about 0.9% a year.

[`tests/contract.test.mjs`](../tests/contract.test.mjs) validates both files against their
schemas and checks what a schema cannot express. Edit a line, then run it.
