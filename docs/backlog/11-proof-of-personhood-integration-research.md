# 11 — Proof of Personhood integration research

## Sprint
Sprint 2 — Product hardening and philosophical differentiation

## Priority
P2

## Objective
Research and design the live integration path for Human free access using the
current Polkadot Humanity / Individuality direction and Product SDK host APIs.

Human free is central to Dotify's philosophical identity, but it must not be faked in production.

## Questions to answer

- What is the canonical live source for humanity / individuality status in the
  current Paseo/Summit product environment?
- Which Product SDK or Host API surfaces can expose identity, product account,
  contextual alias, Ring VRF proof, or DotNS username ownership without
  over-identifying the listener?
- Is the proof bound to the same EVM address used by Dotify on Paseo Asset Hub,
  to a Product account, to a legacy identity account, or to an unlinkable alias?
- If the addresses differ, what linking flow preserves privacy and prevents
  replay across tracks, rooms, products, and chains?
- Should Dotify's current EVM runtime read personhood directly, should a
  registrar/oracle update runtime state, or should the backend make a signed
  access decision while the runtime remains less authoritative?
- What are failure modes and privacy implications?
- How should the UI explain personhood without sounding like surveillance?
- Which parts of the flow require a Product host container, and what is the
  standalone web fallback?

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

### Option D — Product host proof

A Product host provides a product account, contextual alias, or Ring VRF style
proof that Dotify verifies without learning the listener's global identity. This
option must prove what the current Product SDK actually exposes before it can
replace A/B/C.

## Acceptance criteria

- Research doc exists.
- Recommendation is explicit.
- Prototype integration issue list is produced, split into standalone web,
  backend, contract, and Product-host work.
- UI wording proposal is included.
- Privacy tradeoffs are documented.

## Senior-engineer notes

Do not reduce personhood to a checkbox. This is philosophically charged
infrastructure. The implementation must respect dignity, privacy, and the right
not to be over-profiled. Do not assume DIM1/DIM2 names, EVM address binding, or
a final Humanity API shape until the current Product SDK / Individuality source
is verified in the research document.
