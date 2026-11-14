# Host support after the listening merge — 2026-11-14

PR #466 now includes merged dev `fe3010a4fd83cd55ff392473ca7f63b61339b8da`
(#465). Integration implementation `699dd279df2bc3f4c8c1dff90dfe5040d3ae1c3d`
applies the [previously tested resolution](listening-host-support-preview-2026-11-13.md)
to the actual feature branch. The following documentation-only commit changes
no application/test source.

The resolution preserves About's visible primary report action, pre-reload
reminder, Technical details disclosure and opener focus. The report component
accepts both `prominent` and optional `hostSoftware`; copying never awaits the
Host read. The Product fixture checks the report action directly rather than
opening the retired Listening support disclosure.

## Validation on the integrated branch

Verified Node 22.23.5 / macOS arm64; SDK versions unchanged:

- **1,204 frontend unit tests / 155 files pass**.
- **Six targeted Product About/closure browser cases pass**, Chromium and WebKit:
  manual copy, denied clipboard, no account request and isolated late responses.
- **Six raw-wire tests**, TypeScript project build and lint pass. Lint retains
  two existing App hook warnings and has no errors.
- The entire `web`, `services` and `contracts` source is byte-identical to tested
  preview `24f3595f4c74c5505f46b5ec8ad5f5ce5322ff9c`. Its Web/frozen Product builds
  and 36 browser cases therefore remain applicable without redundant full runs.
- Backlog manifest, local links and whitespace are checked. Private logs are in
  `.data/host-info-evidence/integrated-*` in the feature checkout.

The branch still requires its fresh GitHub CI and owner review. This integration
performs no deployment, real Host request, SDK upgrade, payment or musical write.
Named physical Host labels and actual Pause/lock/artwork acceptance remain open;
the earlier successful artwork report is not a failure diagnosis.

Canonical contract: [Host software support](../../../reference/host-software-support.md).
