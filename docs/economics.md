# Economics

Profitability is Foundry's optimization objective. This document defines what that means,
because the definition is the reward signal every automated decision is judged against. An
imprecise definition here produces a system that optimizes the wrong thing very efficiently.

Status: v0.1. The definitions are settled; the worked figures are illustrative.

## Three measures

Foundry reports three numbers. Two are optimization targets. The third is reported but not
optimized, and exists to stop the first two from being gamed.

### 1. Operating margin

```
operating margin = routing revenue − rebalance cost
```

Routing revenue is fees actually collected on settled forwards. Rebalance cost is what
Foundry paid to move liquidity, including the fees paid to other nodes on circular routes and
any failed attempts that still cost fees.

This is the short-horizon signal. It answers: is this channel earning more than it costs to
keep usable?

### 2. Complete profitability

```
complete profitability = operating margin − amortized channel lifecycle cost
```

Lifecycle cost is the on-chain fee to open the channel plus the expected on-chain fee to
close it, amortized across the channel's life. A channel opened in a high-fee block and
closed in another can consume months of routing revenue; a measure that ignores this reports
profit on channels that destroyed value.

Close cost is an estimate until the channel actually closes, and must be labeled `derived`.
Force-closes cost more than cooperative closes and carry a timelock; the estimate should
assume cooperative and record the difference when reality disagrees.

This is the number that decides whether a channel was worth having.

### 3. Return on capital deployed — reported, not optimized

```
return on capital = complete profitability / (capital committed × time)
```

Neither measure above counts the sats locked in the channel. A policy optimizing complete
profitability alone will happily park 10M sats to earn 2k sats a month and correctly report a
profit. Return on capital is what makes that visible, and it is the only measure that gives
Foundry a reason to **close** a mediocre channel and redeploy the capital.

It is reported rather than optimized because the right hurdle rate is the operator's
judgment, not Foundry's. Foundry states the return; the operator decides whether it beats
their alternative use of the sats.

## What Foundry does not count

Stated so that the numbers are not mistaken for something more complete than they are:

- **The operator's time.** Unmeasurable and not ours to price.
- **Electricity and bandwidth.** Roughly fixed, not attributable per channel, and dwarfed by
  capital cost at any realistic node size. Revisit if hardware work makes it material.
- **The exchange rate.** All figures are in satoshis. Foundry does not convert to fiat and
  does not model bitcoin's price. A channel that earned sats earned sats.
- **Payments that are not routing.** Donations the node receives and payments it makes for its
  own purposes are not forwards, so they are neither routing revenue nor rebalance cost. They
  still move liquidity, and Foundry's liquidity reasoning has to expect them.

## A worked example

One channel, opened and closed, with illustrative figures:

| | sats |
|---|---|
| Routing revenue over 6 months | +42,000 |
| Rebalance costs paid | −11,500 |
| **Operating margin** | **+30,500** |
| On-chain open fee | −4,200 |
| On-chain close fee (cooperative) | −3,800 |
| **Complete profitability** | **+22,500** |

Capital committed: 5,000,000 sats for 6 months.

**Return on capital: ~0.9% annualized.**

The channel is profitable by both optimization measures and a poor use of five million sats.
Both statements are true, and Foundry must report both. This is the case the third measure
exists for.

## Attribution requires experiment design

Recording a decision is not the same as attributing an outcome to it. If Foundry raises a fee
and revenue rises, the cause may be the fee, a change in network topology, a peer's own
repricing, or ordinary variance. Logs alone cannot separate these, and a system that reports
"the fee change earned +8%" from logs alone is telling stories about noise.

Any claim that a policy change caused an economic outcome must come from a design that could
have shown the opposite:

- **Holdout channels.** A comparable subset the policy does not touch, chosen before the
  change, not after.
- **Staggered rollout.** Apply to a fraction first; compare against the unchanged remainder
  over the same period, not against the same channels' own past.
- **Pre-registered window.** State the evaluation period and the metric before the change.
  Choosing the window afterward guarantees a favorable result.
- **Randomization where it is safe.** Where assignment can be random without risking capital,
  randomize. Where it cannot, say so and treat the result as weaker evidence.

Baselines matter as much as experiments. Deterministic strategies are the control that any
learned policy must beat on realized sats net of full costs, not on prediction accuracy. A
model that predicts routing demand superbly and allocates capital badly is not an improvement.

## Observed and derived

Every economic figure carries its provenance:

- **Observed** — read from LND or the chain. Settled forward fees, on-chain fees actually
  paid, channel capacity, confirmed closes.
- **Derived** — computed, estimated or assumed by Foundry. Expected close cost, liquidity
  thresholds, opportunity cost, any forecast, any attribution.

The distinction is structural, not stylistic: it appears in the event schema, in stored
records, and in anything Foundry displays. An operator must always be able to tell which
numbers came from their node and which came from Foundry's opinion of their node.
