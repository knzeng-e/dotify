# Product 0.1.56 mobile-form candidate, 2026-10-19

Prepared from merged and tested `dev`
`b08966698709b06378349a6ffd0567cda5dc8f53`, after #305 and #307.
Refs #88, #89 and #306. The owner requested deployment for testing.
This preparation record is not proof of publication or physical keyboard support.

## Package and rollout boundary

- Executable `[0, 1, 56]` preserves `product-cdm` on `devnet`, existing
  permissions, origins, contracts and access/payment policy.
- The frozen public catalog fixture and generated bootstrap are refreshed
  together. All 13 release identities are unchanged; builds publish that
  committed snapshot without a mutable catalog read.
- #307 changes shared viewport/focus behavior and interface styling. API,
  signaling, shared server modules and contracts are identical to the previous
  release. Keep API release 28 and signaling release 36 running; no restart,
  secret, session epoch, volume or topology change is needed.
- Product 0.1.55 is the client rollback artifact, CID
  `bafybeig5b2hue5db3oftgvjzlvb2wezslwdn7j5efj547225s4y4b5zwmy`.
  The existing server versions support both clients.

## Preparation and acceptance

[Merged-dev CI](https://github.com/knzeng-e/dotify/actions/runs/39324502489)
passes all eight quality-gate jobs. Initial local frozen build, 20 publication
guards, six read-only DevNet endpoint checks and fresh live Product Host Remote
Config alignment passed. The independently published Web entry already contains
the exact merged-dev source and the shared form viewport controller.

Build the clean committed packaging SHA again before publication. Record its
signer-free validation, exact source, Product CID/version and finalized root/app
read-back. Independently verify public CAR block hashes and index/entry bytes.
Check the Web source separately because it is deployed independently.

Use temporary synthetic sessions only for live room checks and close them after
the smoke. Test room-name and invitation visibility, draft retention and first
tap after keyboard dismissal on the published Web. Browser viewport simulations
remain distinct from physical iPhone/Android and Product Mobile/Desktop evidence.
The [form validation record](mobile-form-continuity-2026-10-19.md) lists the
remaining native keyboard, rotation, focus and audio checks.

The DotNS signer must remain local and ephemeral. Remove it after publication;
never store it in the repository, frontend configuration, CI, arguments or report.
