# Backlog and navigation checkpoint, 2026-10-26

This follow-up checks the delivery records affected since the October 23 audit,
plus the documentation for PR #337. It is not a fresh physical-device audit or
a new release. GitHub Project 5 remains the workflow-status authority.

## Delivered implementation records

| Issue | Delivery evidence | Remaining boundary |
| --- | --- | --- |
| #329, scoped 3D galaxy | #330 merged; Product 0.1.61 published through #331; owner confirmed installed behavior | Full physical graphics/location/media matrix remains #274/#85/#89/#158 |
| #286, W31 discovery follow-ups | #297 behavior plus #332's [Worldwide Report verification](W31-worldwide-report-2026-10-25.md) merged | Browser Host fixtures are not physical permission/location acceptance |
| #289, W34 fast access | #333 merged; [API/Web and Product 0.1.62 published](product-0.1.62-rollout-2026-10-25.md) through #334 | Synthetic key-wait reduction is not audible-startup or prolonged native listening evidence; #88/#287/#317/#158 remain |

These issues become closed records with Project status Done, Type Record and
Phase Record. Their priority, track and scope document stay unchanged. Do not
reimplement them from the old sequence prompts. The manifest, overview, ticket
checkpoints and live cards are reconciled together.

## Merged, reviewed and published are different states

- **Published:** the last recorded candidate is Product 0.1.62, API release 32
  and the Web build recorded in #334. This audit does not remeasure endpoints.
- **Merged, not published:** #335 recovers a proven unsigned Product approval
  expiry without guessing about old uncertain payments. #336 returns artists to
  their releases after authoritative publication confirmation and repairs the
  audio-continuity CI fixtures.
- **Open review:** #337 coordinates room exits, mini-player dismissal, studio
  media continuity and canceled joins. The replay-after-dismissal finding was
  open at this checkpoint; its October 27 correction is recorded below.

## Navigation documentation and evidence

The [user guide](../../../how-to/listen-together.md) distinguishes browsing,
leaving and mini-player dismissal. The [architecture explanation](../../../explanation/listening-rooms.md)
records the shared media owner, cancellation and invitation cleanup. The public
project page describes the change as pending publication. The deployment
runbook lists candidate-bound physical checks without inventing new settings.

PR #337 source `99ec55cce13ae5710cdecd28bfd7df0c3099fc5d`, based on merged
`dev` `a76da746d483c721ab0f9935e1dbcdf380cbae60`, passed 1,014 unit tests and
276 core Chromium scenarios locally. All ten quality gates passed in
[CI 40327623663](https://github.com/knzeng-e/dotify/actions/runs/40327623663),
including discovery/rollback, encrypted audio continuity, three-engine streaming,
Product identity and sign-out recovery. These results describe that tested
source, not a deployed mobile/Desktop acceptance claim.

## Next work and gates retained

Review and integrate the pending navigation correction before packaging a new
client candidate. W35/#290 is then the next eligible streaming implementation;
W32 and W34 do not need rebuilding. W33/#288 retains its recorded gateway-access
and measured activation blocker; no gateway probe or config activation ran here.

W13/#158 remains `hold`. Preserve native signing/value-flow acceptance
(#229/#269/#85), real publication/pinning (#287/#317), first sound (#88), covers
(#87), independent-network TURN and capacity (#89), and exact-Host location
lifecycle (#274). No participant recruitment, funded transaction, contract
upgrade, signer access or deployment is part of this reconciliation.

## Reconciliation checks

The complete manifest passes both offline validation and the live GitHub issue /
Project 5 comparison after the three closure updates. All 186 local Markdown
links in the changed documentation resolve. The pilot plan's contract addresses
and SDK versions match `deployments.json` and `web/package.json`. All 13 pilot
readiness tests pass; whitespace checks pass. Application code is unchanged by
this documentation follow-up; its browser evidence remains bound to `99ec55c`.


## Review follow-up, 2026-10-27

The loaded-source replay path now explicitly clears the mini-player dismissal.
Pausing a deliberately replayed track therefore retains its controls; another
Close still pauses and hides them. This change stays in the user-action handler,
not an effect driven by media events, so a late source cannot undo dismissal.
It reuses the existing loaded source and preserves catalog access checks.

Both 320px and 1440px regressions first failed at the paused dock visibility
assertion, then passed after correction. All 13 exit/dock Chromium scenarios and
1,014 unit tests pass; lint/formatting and the Web build pass with existing
warnings. One browser run crossed a long machine interruption and is not counted
as acceptance; the clean complete rerun passed without relaxed assertions.
Native acceptance and deployment remain separate gates.
