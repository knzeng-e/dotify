# 11 — Proof of Personhood integration research

## Sprint
Sprint 2 — Product hardening and philosophical differentiation

## Priority
P2

## Objective
Research and design the live integration path for Human free access using Polkadot Proof of Personhood / Individuality data.

Human free is central to Dotify's philosophical identity, but it must not be faked in production.

## Questions to answer

- What is the canonical live source for personhood level?
- How does a listener prove or expose their DIM1/DIM2 status?
- Is the identity bound to the same EVM address used on Paseo Asset Hub?
- If not, what linking flow is required?
- Should the runtime read personhood directly, or should a registrar/oracle update runtime state?
- What are failure modes and privacy implications?
- How should the UI explain personhood without sounding like surveillance?

## Deliverables

Create:

```txt
docs/research/proof-of-personhood-integration.md
```

The document must include:

- architecture options;
- security assumptions;
- privacy analysis;
- UX implications;
- recommended MVP path;
- open questions for Polkadot/Individuality teams.

## Recommended options to compare

### Option A — Runtime registrar mirror

A trusted registrar updates `musicAccPersonhoodLevel(listener)` based on verified external source.

### Option B — Frontend/backend read + signed access decision

Backend verifies personhood and only releases content keys when valid, while runtime remains less authoritative.

### Option C — Direct on-chain read

Runtime or precompile reads canonical personhood state directly, if technically available.

## Acceptance criteria

- Research doc exists.
- Recommendation is explicit.
- Prototype integration issue list is produced.
- UI wording proposal is included.
- Privacy tradeoffs are documented.

## Senior-engineer notes

Do not reduce personhood to a checkbox. This is philosophically charged infrastructure. The implementation must respect dignity, privacy, and the right not to be over-profiled.