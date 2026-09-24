# OBL payments and Lightning Factory proof of concept

Ooga Booga Land's proof of concept has two tracks that run independently. **Payments:** a
dedicated OBL Lightning node takes real donations through BTCPay Server, and the banana pile
and leaderboard update as they settle. **The Lightning Factory:** a cave that shows the node at
work, built first on simulated events and later driven by the real node.

This document maps that plan onto Foundry's milestones and contracts. The plan itself is OBL's,
from its working draft of September 2026. Its custody limits, funding and operator
arrangements are deliberately not repeated here: they tell an attacker what the node holds and
who runs it, and they are OBL's to publish.

## Where the plan meets Foundry

| POC step | What Foundry provides | When |
|---|---|---|
| Define an event interface for node activity | [`foundry.public.event.v1`](../../schemas/foundry-public-event.v1.schema.json) and its [examples](../../examples/) | now |
| Build the cave on simulated events | the schema and examples now; the simulator's seeded, repeatable scenarios later | now, then M1 |
| Show the node going offline | `node.stopped`, and scheduled batches that stop arriving | M1 |
| Integrate real node activity | a read-only Foundry node publishing through the export, and OBL's ingest endpoint | M2 |
| Keep channel management and payouts manual | Foundry instructs the node in nothing before M4, and in M4 only with an operator approving each action | until M4 |
| Run Foundry: channel allocation, optimization, rebalancing, local AI | the later milestones, each gated as [`roadmap.md`](../roadmap.md) describes | M4 to M6 |
| Add rooms for more nodes | once the multi-node risks in [`oogabooga.md`](oogabooga.md) are settled | later |

The plan says the proof of concept does not depend on Foundry being ready, and nothing here
changes that. The table says what each step can use when it gets there.

## The cave can start now

The event interface the plan asks for already exists. The cave should read
`foundry.public.event.v1` exactly — validate strictly, order by `seq`, and follow
[Reading the public stream](../event-model.md#reading-the-public-stream) — and the Factory's
behaviors are already mapped to events in [`oogabooga.md`](oogabooga.md#event-mapping). Built
that way, it takes simulated streams and real ones without a change.

## Real events come through the export

This is the step that could quietly undo the design. A script that reads LND and posts to the
cave publishes whatever it reads — channel ids, exact amounts, exact times, liquidity — and
every protection in the public schema is gone.

Real events should come from Foundry's export, and the earliest safe point is M2: a read-only
Foundry node observes and publishes, and instructs the node in nothing. OBL's side needs the
ingest endpoint described in [`oogabooga.md`](oogabooga.md#obls-side-of-delivery). Until both
exist, the cave runs on simulated events, as the plan intends.

## A node with three jobs

The OBL node will route, receive donations, and later pay developers. Donations settle as
BTCPay invoices, and payouts are payments the node makes. Neither is a forward, so neither is
routing revenue or rebalance cost, and Foundry keeps both out of the measures in
[`economics.md`](../economics.md). They still move liquidity — a donation uses up inbound
capacity on the channel it arrives through, and a payout drains the outbound side — so
Foundry's liquidity reasoning has to expect them. OBL's donation records carry a USD
equivalent; Foundry's measures stay in sats.

## A second public view of the node

The plan updates the pile and the leaderboard the moment a Lightning payment settles, with its
amount. That is a public record of exact amounts arriving at exact times, at the same node the
Factory describes — precisely what the Factory's bucketing withholds. It shows when inbound
capacity was used and by how much, not the node's balances, and for a donation node that is a
reasonable trade. It sits outside the Factory's protections, and should not be mistaken for
being inside them.

## Moving to permanent hardware

The plan's migration closes every channel, restores the node's Lightning identity on permanent
hardware, and opens new channels. In Foundry's terms:

- The closes and the new opens are lifecycle costs like any other, counted against complete
  profitability.
- The internal event store moves with the node, so `seq` carries on. OBL's ingest ignores any
  `seq` it has already accepted, so a node that started again from 1 under the same name would
  have its events dropped as repeats. If the store cannot move, enroll the new node under a new
  name and credential.
- The export key and per-node credential move with the node or are reissued, and never live on
  both machines at once. The plan's rule that the original and restored LND never run at the
  same time applies to the export too: two exports publishing as one node collide on `seq`.

## For this node

Publish rebalance successes only. It is the strongest single mitigation in
[`oogabooga.md`](oogabooga.md#further-mitigations-if-wanted), and this is the node it was
recommended for.
