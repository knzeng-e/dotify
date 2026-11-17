# Listening support integration preview — 2026-11-13

This is a compatibility rehearsal for #466 after the selected #465 grouping.
It changes neither PR head nor dev and does not add Host reporting to the
0.1.84 delivery scope. No real Host/account/signing or deployment call occurs.

## Source and conflict resolution

Preview `24f3595f4c74c5505f46b5ec8ad5f5ce5322ff9c` merges selected #465 head
`b08cca09d3de1f8e82db531b524111e8c028741f` and #466 head
`1b84caf546337788d4715507f603b31337822cb1`. Two component conflicts are resolved:

- About retains the directly visible primary report action, pre-reload reminder,
  Technical details disclosure and explicit opener focus from #465, while passing
  optional Host software to the report and including its public row in app details.
- `AudioFailureDiagnostics` accepts both the existing `prominent` option and the
  optional `hostSoftware` observation. Copy stays explicit and immediate; the
  existing selectable clipboard fallback remains.
- The Product test helper now requires the report button to be directly visible;
  it does not reopen the retired Listening support disclosure.

This merge owns no playback/Room control change. Future integration must first
verify these parent identities or compare any later owner changes; do not copy
resolved files over a changed component blindly. The following evidence-only
commit changes no application or test bytes.

## Local validation

Verified Node 22.23.5 on macOS arm64, pinned SDK/Host/TrUAPI unchanged:

| Check | Result | What it verifies |
| --- | --- | --- |
| Frontend unit suite | 1,204 pass / 155 files | Combined ownership, cancellation, telemetry and existing frontend invariants |
| Product identity browsers | 16 pass across Chromium/WebKit | Existing accounts, public Host labels, direct report action, denied clipboard and late-close isolation |
| About on ordinary Web | 10 Chromium + 10 WebKit pass | 320/390/1280-pixel accessibility, manual/fallback copy and focus restoration with Host mode off |
| Web/frozen Product builds | Pass | Typecheck and build composition |
| Lint | Zero errors | Two existing App hook warnings remain |
| Backlog/diff checks | Pass offline | Manifest and whitespace |

The 390-pixel WebKit Product fallback capture is inspected: the report action is
visible above Technical details, no horizontal overflow occurs, and the selected
JSON includes only the optional software observation. The Host and its responses
are simulated; the displayed synthetic app version is not a delivered release.
Existing large-bundle advisories remain.

Private generated logs/captures are retained in the preview checkout under
`.data/integration-evidence` and `web/.data/integration-*`. No owner report,
wallet detail or key is committed.

## Remaining gates

The PRs' own exact-head CI and owner review remain authoritative for merging.
After #465 merges, synchronize the actual #466 branch with tested dev and verify
that this prepared resolution still matches; only then promote its integrated
source and run required CI. This preview is not a third merge target and does not
replace actual phone Pause/unlock, cover/native display or audible guest checks.
Matching delivery and named-Host software labels remain open. No SDK upgrade,
CASH availability, musical write or independent recovery is enabled.

Canonical behavior: [Host software support](../../../reference/host-software-support.md)
and [artwork observations](../../../reference/system-artwork-observations.md).
