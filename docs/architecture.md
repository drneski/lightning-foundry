# Architecture

The intended shape, written before the runtime exists so the boundaries are decided rather
than discovered. Expect this document to change as real components land; expect the trust
boundaries not to.

## Layers

```text
┌──────────────────────────────────────────────────────────────┐
│  Local UI          Assistant (explains, changes nothing)     │
├──────────────────────────────────────────────────────────────┤
│  Intelligence — advisory only, proposes, never executes      │
├──────────────────────────────────────────────────────────────┤
│  Policy — deterministic limits. The only path to an action   │
├──────────────────────────────────────────────────────────────┤
│  Foundry Core — observation, accounting, events, execution   │
├──────────────────────────────────────────────────────────────┤
│  LND  +  Lightning Jet                                       │
│  Bitcoin Core                                                │
└──────────────────────────────────────────────────────────────┘
```

Read it as a permission gradient. Everything above Policy can *ask*. Only Policy can *allow*,
and only Core can *act*.

## The one rule

**Nothing reaches LND except through Policy, and Policy is deterministic code.**

A model may produce a proposal. A proposal is data. It becomes an action only after
deterministic code has checked it against limits the operator set, and that code contains no
model, no heuristic that changes with training, and no path that can be widened at runtime.

This is [invariant 6](invariants.md) as a structural property rather than a promise. If the
intelligence layer is compromised, wrong, or replaced by something malicious, the worst it can
do is make proposals that Policy rejects.

## Components

| Component | Holds | Responsibility |
|---|---|---|
| **Core / observer** | LND read macaroon | Subscribes to LND, normalizes to internal events, persists them |
| **Core / accounting** | nothing | Turns events into the measures in [`economics.md`](economics.md) |
| **Policy** | LND action macaroon | The only component that instructs the node; enforces limits and budgets |
| **Intelligence** | nothing | Reads history, emits proposals; no credentials, no network |
| **Assistant** | nothing | Explains state in language; read-only by construction |
| **Export** | export key, per-node credential | Translates internal events to the public schema and pushes them to one configured endpoint, opt-in; holds no LND credential |
| **UI** | nothing | Local interface; talks to Core, not to LND |

Two things follow from the table. **LND credentials live in exactly two places**, and they are
different credentials. And **the intelligence layer holds nothing** — no keys, no network, no
ability to act — which makes it the cheapest component to be wrong about.

## Trust boundaries

Four, in order of how much it costs to get them wrong:

1. **Seed and wallet.** Outside Foundry entirely. Foundry never holds, reads or needs one.
2. **Action credential.** Held only by Policy. Scoped with LND's baked macaroons so that even
   a total compromise of Policy cannot do what its macaroon does not permit.
3. **Read credential.** Held by the observer. Leaks operational data if compromised; cannot
   move funds.
4. **Export.** Internal events become public events here, by translation into a different
   schema — never by filtering fields out of the internal one — and leave the machine only as
   signed batches the node pushes out. Nothing can connect in to fetch them. See
   [`event-model.md`](event-model.md).

## Data flow

```text
LND ──(read macaroon)──► observer ──► internal events ──► store
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                   ▼                   ▼
                     accounting          intelligence          export
                          │                   │                   │
                          └──► proposals ◄────┘                   ▼
                                   │                        public events
                                   ▼                  (opt-in, signed, pushed)
                                POLICY ──(action macaroon)──► LND
```

The store is the seam. Everything downstream reads events rather than querying LND directly,
which means accounting and intelligence can be replayed against history, tested against
fixtures, and run against the simulator with no node present.

Public events leave by one path: the export pushes signed batches to a single configured
endpoint, and the node listens for nothing. The Delivery section of
[`event-model.md`](event-model.md) sets out the rules.

## Failure isolation

What happens when each piece dies:

| Fails | Consequence |
|---|---|
| Assistant | Nothing. It only ever talked. |
| Intelligence | No proposals. Baselines and manual operation continue. |
| Policy | No actions execute. The node keeps routing; Foundry stops instructing it. |
| Observer | No new events. The node keeps routing; Foundry goes blind. |
| Export | The public feed stops. Nothing else notices. |
| Foundry entirely | LND and Bitcoin Core carry on. The operator resumes manual control. |

There is no failure mode in that table where Foundry breaking takes the node down with it.
That is the requirement, not a happy accident: Bitcoin Core and LND are the trust anchors, and
Foundry is a management layer on top of them.

## Deliberately outside

- **The Lightning protocol.** LND implements it. Foundry never will.
- **Payment processing.** Donations, invoicing and merchant flows are a separate concern with
  a separate stack. BTCPay Server lives on Ooga Booga Land's payments side and is not a Foundry
  dependency — see [`integrations/obl-payments-poc.md`](integrations/obl-payments-poc.md).
- **Any cloud component.** There is no server half of this product.
- **Visualization.** Foundry emits events; consumers draw pictures.

## Open decisions

**Implementation language is undecided**, and deliberately so — there is no manifest in this
repository yet, because adding one would decide it silently.

The considerations: LND is Go and its gRPC bindings are first-class there. Lightning Jet is
Node, and M2 integrates Jet rather than rewriting it. A component holding an action macaroon
and enforcing capital limits has a real argument for a compiled, memory-safe language. These
pull in different directions and the answer may be "more than one," with the event store as
the seam between them.

Whatever the answer, it should be recorded in [`decisions/`](decisions/) with its reasoning,
because it is the kind of choice that is expensive to revisit and easy to forget the reasons
for.
