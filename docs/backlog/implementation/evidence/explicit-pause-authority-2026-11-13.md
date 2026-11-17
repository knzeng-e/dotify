# Explicit Pause authority — 2026-11-13

**Implemented candidate; not deployed or physically accepted.** Refs #395.
Source `d1168e0f` starts from tested dev `0bb52754`; the later evidence/test-diagnostics
changes do not modify these application files. Matching delivery must precede
another phone acceptance claim. The [continuity contract](../../../explanation/continuous-listening.md#system-controls-and-return)
owns behavior; [ADR 0059](../../../adr/0059-preserve-solo-during-room-preparation.md)
owns the preparation boundary.

## Owner feedback

On requested Product 0.1.83 checks, the owner confirms audible/control continuity
during solo-to-Room preparation and audible Web/Desktop guests through the short
phone lock. Pause during preparation is not respected: music starts when the Room
opens. A further report describes intermittent resume on unlock after a native
locked-screen pause. Actual Host/runtime version is not restated in this reply.
These are failure observations, not a measured root cause for every native event.

The separate #388 cover failure follows a requested signature and immediate lock.
A subsequent uploaded report is explicitly a **successful** cover/sound run:
image preparation and PNG metadata assignment finish in 20 ms. It is a useful
control, not timings from the missing-cover attempt. The earlier fresh-page empty
report follows an app restart and cannot diagnose that lost attempt. Keep artwork
acceptance open; do not attribute the failure to networking or iOS from this data.

## Correction and invariants

`ListenerShell` no longer toggles Play for a current ready source or re-arms a
current managed source at Room creation. Another/unloaded track remains an
explicit new playback action. `usePlayback` records a native pause of the current
loaded element, independently of the Media Session pause callback. Removed-src
retirement and natural end do not become a pause of a successor.

The existing shared intent gates late native `play`/`playing` observations before
publishing transport or creating a new capture. Explicit UI or registered system
Play re-arms it. The output gate silences residual audio too; guests gain no key
or control, and access denial/retirement stay authoritative. No visibility-resume
handler, polling, persisted playback intent, new dependency or second controller
is introduced. Browser events cannot prove that every Host delivers native
commands correctly; actual native Play/Pause and lock/recovery remain gates.

## Validation

- Unchanged-dev full-app tests fail all four new Chromium cases: current-track
  Room creation after UI/native Pause, and unsolicited foreground play after
  system/native Pause. The real managed AAC test additionally reproduces the
  native-pause handoff defect on Chromium. Its initial WebKit immediate-time
  assertion runs before metadata; exclude that failure from defect proof. The
  corrected test explicitly awaits readiness and retained position.
- Corrected focused full-app tests: **10/10** across Chromium/WebKit, including
  another-track Play. Managed preparation checks: 13 pass initially, one new
  WebKit check has the premature time assertion; the corrected native check then
  passes both engines. No application assertion/deadline is weakened.
- Complete authenticated AAC continuity suite: **103 pass, one designed native
  WebKit capability skip in Chromium**. It includes pause, cancellation, denial,
  source retirement, transport retry and automatic successor adoption.
- Complete mobile-host suite: **21 pass, one WebKit zero-output-RMS failure**
  after suspended-output recovery. The same case fails three unchanged repetitions
  and a control with all three application files restored to dev. Retain this
  pre-existing unresolved engine/output gate; do not treat an advancing clock,
  running context or successful Play promise as audible output. The test keeps
  its RMS threshold/deadline and gains bounded synthetic failure attachments.
- **1,174 unit tests**, lint and Web/Product builds pass on verified Node 22.23.5.
  Existing App.tsx hook warnings and large-chunk build advisories remain.

Application SHA-256 identities (at the checked source):

- `web/src/hooks/usePlayback.ts`: `cab0f82d58699a5b6a617337ec3d8df6b70f18b38f323452aeb0e560492734e4`.
- `web/src/components/PersistentAudio.tsx`: `8a80522679f236db075dfda0198f9132244d0118f45a4fa544704c5f6688f367`.
- `web/src/views/ListenerShell.tsx`: `36aee3dfb702cb5aede690fa9b6c2d0f42bb95545fffd701768d6fc1d7b1e8e1`.

## Remaining acceptance

After review/merge and a separately reviewed matching client publication, repeat
Pause before/during same-track Room preparation, native Pause while locked,
foreground return without a Play gesture, explicit native/UI Play and audible
Web/Desktop guests. Include ordinary end/Next and access/disconnect teardown.
Collect a report before retry/reload if the cover or sound fails. A registered
system Play callback may itself be a new command: this candidate does not prove
whether the installed Host ever sends an unwanted callback on unlock. Keep #395
and #388 open, and keep real independent recovery deferred as requested.

This implementation performs no live musical write, service maintenance, SDK
migration or paid/CASH action. Client delivery remains the frozen 0.1.83 artifact;
none of these candidate changes is published by this PR.
