# 0002. Rebalance events are published, under constraints

**Status:** accepted, 2026-09-23

## Decision

`rebalance.succeeded` and `rebalance.failed` are part of the public feed, so the REBALANCER in
Ooga Booga Land's Lightning Factory is driven by the real node. The schema forbids attributing
a rebalance to a line, giving it a success rate, or timing it finer than the hour. The export
holds each hour's rebalances until the hour closes.

## Alternatives

- **Withhold them entirely**, as the public feed withholds liquidity events.
- **Publish only an aggregate count**, which was the first draft of the public schema.
- **Publish successes only**, dropping `rebalance.failed`.

## Why

Rebalancing is the part of running a node the Factory most wants to teach — the loop runs from
watching a gorilla build a channel to learning why a rebalance happened — and the interior art
is built around the machine that does it. The constraints remove what makes a rebalance
dangerous to publish — which line, exactly when, how often it fails — while keeping the fact
that maintenance happened.

## Consequences

- Rebalancing is the one public event that touches liquidity. Seven residual risks, including
  a feedback loop for a jamming attacker and correlation with `forward.failed`, are accepted
  and recorded in [`integrations/oogabooga.md`](../integrations/oogabooga.md).
- For the node holding real donations, publishing successes only remains the recommended
  further mitigation.
