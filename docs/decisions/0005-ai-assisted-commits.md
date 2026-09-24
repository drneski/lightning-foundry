# 0005. Every commit is written with AI assistance and names the model

**Status:** accepted, 2026-09-23

## Decision

Every commit to Foundry is written with AI assistance and carries a `Co-Authored-By` trailer
naming the specific model, with the vendor's own noreply address where one exists. Any
assistant qualifies. A pull request whose code was substantially AI-generated says so in its
description and names the tool.

## Alternatives

- **Permit AI assistance**, and require disclosure when it is used.
- **No policy.**

## Why

Foundry is AI-native in how it is built, and requiring it makes that a property of the project
rather than a description of it. Naming the model makes provenance auditable: a reviewer knows
how a change was produced, and a pattern of mistakes can later be traced to the model that made
it. A generic "AI-assisted" label would record neither.

## Consequences

- A commit without a trailer is incomplete, the same as a commit without a message.
- Contributors need an assistant of their own choosing; the project prescribes none.
- AI in how Foundry is built is separate from AI in what Foundry may do, which stays advisory —
  see [`ai-strategy.md`](../ai-strategy.md#where-the-ai-is-not).
