# 12 — Ambassador and social propagation model

## Sprint
Sprint 2 — Product hardening and philosophical differentiation

## Priority
P2

## Objective
Design Dotify's ambassador model: listeners become measurable cultural promoters for artists by helping music travel through rooms, listens, reactions, and invitations.

This is not a growth hack. It is the social and philosophical layer of Dotify: music as a living common carried by humans.

## Scope
Create a product and technical design document. Do not implement contracts yet.

Deliverable:

```txt
docs/product/ambassador-model.md
```

## Questions to answer

- What counts as meaningful promotion?
- How do we avoid spammy referral mechanics?
- What events should be tracked?
- Which events should be on-chain vs off-chain?
- How can artists reward top ambassadors?
- How can listeners remain humans, not extraction targets?
- What is the minimum version that can be tested without tokenomics theater?

## Candidate events

```txt
ROOM_CREATED
ROOM_JOINED
TRACK_SHARED
TRACK_LISTENED
TRACK_UNLOCKED
ARTIST_DISCOVERED
AMBASSADOR_REACTION
QUEUE_ADDED
```

## Candidate rewards

- artist thank-you badges;
- limited NFT/memory object;
- access to private listening rooms;
- public recognition on artist profile;
- future revenue-sharing experiments only after legal and ethical review.

## Design constraints

- Avoid speculative token-first mechanics.
- Avoid fake engagement incentives.
- Respect artist sovereignty.
- Respect listener privacy.
- Prefer transparent, explainable metrics.
- Make the first version useful even without tokens.

## Acceptance criteria

- Product design doc exists.
- Event taxonomy is proposed.
- Anti-spam model is proposed.
- Privacy model is proposed.
- MVP implementation tickets are proposed.
- At least one UI sketch or flow is described in text.

## Senior-engineer notes

Do not build a casino wearing headphones. The ambassador system should reward care, discovery, and cultural transmission — not empty clicks.