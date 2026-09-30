# Capture a paired Product Celerity run

For the W27 operator. This collects evidence; it does not deploy a build, send
messages automatically, pay, or approve a migration. Read the
[transport decisions](../explanation/room-realtime-transports.md) first.

## Prerequisites

- A separately authorized candidate with `VITE_DOTIFY_ROOM_REALTIME=dual`, a
  recorded 40-character build SHA and actual deployed CID, on both clients.
- Updated signaling service with `room:realtime-register` and
  `room:realtime-clock`. No new production secret or server flag is required.
- Exactly two consenting Product participants, the diagnostic capture panel
  (`VITE_DOTIFY_DEBUG_PANEL=true`) or an operator console on each client,
  recorded Host/OS/device versions and a
  non-sensitive test room. Use short test text, not personal conversations.
- Both private observers report `ready` in
  `window.__DOTIFY_ROOM_REALTIME__.snapshot().observations`. Ordinary standalone
  browsers intentionally report unsupported and cannot substitute for Product.

If a Host exposes neither the capture panel nor an operator console, record that
limitation. A browser simulation or an invented Host version is not a real-device
capture. The console-only 0.1.30 deployed candidate predates the capture panel;
shipping the panel requires a separately authorized candidate on both clients.

## Resolve permissions before measuring

Use a disposable test room to resolve Product's Statement Submit permission
before starting the paired run. A permission dialog can outlast the observer's
eight-second deadline. `Allow Once` may prompt again for the next publication;
ask the owner explicitly before selecting a persistent permission, and record
who granted it. This permission concerns Celerity publications, not payments.
Never bypass the prompt or widen unrelated domain permissions.

After a timeout, export the diagnostic capture before changing sessions. A
timeout is an uncertain write, not proof that no statement was published.
Do not replay that message automatically. Use a distinct event after normal
room reconnection and verify both observers are ready. Do not simply increase
the write deadline: the private payload expires after ten seconds.

A full host-page reload is not a transparent reconnect. The host resume token
is intentionally memory-only; reloading loses it and can end the room. Warn
participants and obtain approval before interrupting an occupied test room.
For a socket-recovery measurement keep the webview alive. If a full reload is
necessary, create a new test room and start a new run on both clients.

Separate `submitted` and local `self-echo` from receipt on the other device.
An SDK response-decoding error after a delayed permission is not by itself
proof of a Host/SDK version mismatch; retain the error and test a distinct
publication with permissions already resolved before diagnosing compatibility.

## Start both recorders

### Without a mobile console

1. Join the test room normally, then open **You > Production readiness >
   Celerity capture**. Navigating to You does not end the room or a recording.
2. Enter the same paired run ID and deployed executable CID on both devices.
   Choose A on Desktop and B on Mobile; enter actual device/OS, Host version and
   network. These are operator declarations, not automatically attested facts.
   Do not enter account names, secrets, room codes or location.
3. Select **Start capture** on both clients. Missing room admission, clock
   failures or an invalid CID remain explicit errors. The panel sends no
   Celerity publication itself and never grants Host permissions.
4. Return to the room for the events below. Select **Test phase** before each
   recovery scenario; use **Calibrate clock** after recovery and at least every
   90 seconds. The last uncertainty and sample age remain visible in the panel.
5. After the final TTL window, select **Stop capture**, then **Copy capture**.
   The stopped JSON is also displayed as selectable text if clipboard access
   fails. Transfer that JSON to the operator's local A or B file as below.
   **Copy diagnostics** is a different, bounded snapshot of observer states;
   it is useful for errors but is not a capture file accepted by the reporter.

Metadata is locked until the stopped capture is explicitly cleared. The clear
action requires confirmation. Nothing is automatically uploaded or persisted;
reloading loses the recorder. Stop within five minutes; the panel reports dropped
records and the recorder's duration limit, never a delivery pass. Older clients
without the panel use the console flow below.

### With an operator console

Join the same room normally. No wallet gate is added for guests. In each
client's application console, replace the declared values; use the same run ID
and CID, and different A/B labels. Do not put account names, addresses, secrets,
room codes or location in these labels.

```js
const capture = window.__DOTIFY_ROOM_REALTIME__.capture;
await capture.start({
  run: 'w27-20260930-baseline-01',
  client: 'A', // B on the second client
  cid: 'REPLACE_WITH_ACTUAL_CANDIDATE_CID',
  device: 'REPLACE_WITH_DEVICE_AND_OS',
  hostVersion: 'REPLACE_WITH_PRODUCT_HOST_VERSION',
  network: 'wifi'
});
```

Start takes three admitted Socket.IO clock samples and retains the smallest
round-trip uncertainty. It sends no Celerity statement itself. The server limits
clock reads to ten per ten seconds per admitted socket. Wait before repeated
calibration; a refused read is an explicit error, not a fabricated offset.

Run for 60 seconds. In both directions send a short reaction, chat and a new
track request through the existing room controls, spaced at least 12 seconds
apart. Presence publishes only from the host every ten seconds. Check the
diagnostics for quota rejection: the entire sponsored-account data budget is
1024 bytes, shared with presence/beacons and possibly other applications. If a
class is not submitted, record it as unmeasured, not as delivered by Celerity.
Socket.IO may deliver the visible message even when its mirror is absent.

## Exercise failure and recovery

Use separate paired runs for the following conditions. Before the action, set
the matching phase on both clients; phase labels are operator declarations.
Visibility and online/offline markers are collected automatically where exposed
by the Host. They do not prove radio state or audible playback.

```js
capture.phase('background'); // or network-change, reconnect, expiry
```

1. Background one physical device, send from the foreground peer, return after
   more than ten seconds, and note sound, delivered chat and mirror observations.
2. Change Wi-Fi/cellular or interrupt the network. Note exact action/time,
   canonical room recovery, visible errors and audio. Do not mark this phase
   passed because the UI stayed open.
3. Reconnect or leave/rejoin the listener if its observer stopped. After both
   observers are ready, run `await capture.calibrate()` before further messages.
   New membership keys replace the old ones. No uncertain publish is retried.
4. For expiry, suspend longer than the private ten-second TTL. A Host may discard
   expired statements before Dotify receives them; zero expired receipts alone
   is not proof that application expiry ran. Keep the deterministic expiry tests
   and any available Host trace as separate evidence.
5. Separately join an ordinary browser guest without wallet and verify audible
   room playback. Do this outside the two-Product-participant measurement window
   so recipient fanout cannot be mistaken for loss. Recheck host-only key access,
   lineup reconciliation, and longer-than-160-byte messages staying on Socket.IO.

Recalibrate after recovery and at least every 90 seconds during longer runs.
Clock samples expire after 120 seconds or a detected local clock jump. A server
restart changes its random clock ID; cross-epoch latency is unavailable.
Keep each capture below five minutes. Limits are 2000 frame records, 16 pending
hashes, 100 environment markers and 16 calibrations. `dropped > 0` invalidates
complete-capture claims; it does not break the room.

## Export and compare

Stop sending and leave both clients recording for at least 35 seconds, so the
last presence/private TTL has elapsed. Recalibrate near the end if needed. Stop
both recorders and export **only** the capture object, not the whole diagnostic
snapshot. `copy` below is a DevTools helper, not a Dotify browser API:

```js
const evidence = await capture.stop();
copy(JSON.stringify(evidence, null, 2));
```

On the Mac operator terminal, deposit each clipboard export in a private file:

```sh
umask 077
pbpaste > /tmp/dotify-w27-A.json
# Repeat after copying B's export:
pbpaste > /tmp/dotify-w27-B.json
cd web
node scripts/celerity-capture-report.mjs /tmp/dotify-w27-A.json /tmp/dotify-w27-B.json
```

Keep raw captures with the evidence record under the agreed retention policy;
they are not automatically uploaded. SHA-256 fingerprints are salted by the
shared run label, correlate packets/streams only within that run and contain no
plaintext, raw producer IDs or ciphertext. Operator metadata is not attestation.
`capture.clear()` removes the current in-memory capture; reload also removes it.

Read the report conservatively:

- `submitted`: Host returned success, not an acknowledgement from the recipient.
- `unknownSubmission`: attempt without a definitive outcome, never an automatic retry.
- `accepted`: matching application observation, not UI delivery via Celerity.
  Private messages are membership-authenticated; public presence is explicitly
  untrusted (`observationTrust`), even when its packet fingerprint matches.
- `unobservedWithFullWindow`: submitted but unmatched despite recording the TTL
  window; not a proven network loss. Channel replacement, other recipients,
  suspension or upstream Host filtering may explain it. Short windows are separate.
- Latency measures attempt to authenticated observation, including submission
  and decryption. p50/p95 estimates retain an explicit clock uncertainty; missing
  clocks, inconsistent clocks and server-epoch changes are counted separately.
- Duplicate, accepted reorder, replay-window rejection and authenticated expiry
  are separate observations. Upstream deduplication cannot be reconstructed.

Finish the W27 evidence with actual attempts, failures, Host/device/network
matrix, artifacts and a reviewed migrate/hybrid/retain decision for each class.
The tool deliberately does not declare W27 complete or enable a transport.

## Roll back

Stop/reload observation sessions and rebuild with `VITE_DOTIFY_ROOM_REALTIME=off`
under the normal release process. In-flight Host writes may still arrive until
expiry. Socket.IO remains canonical throughout; no payment, contract, stored
content key or wallet state needs migration. Do not deploy the rollback without
the usual authorization.
