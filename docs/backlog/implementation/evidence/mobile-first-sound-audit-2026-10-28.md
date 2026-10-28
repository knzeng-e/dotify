# Mobile first sound and architecture audit, 2026-10-28

Refs #88; partial [W08](../W08-first-sound.md). This corrects a reproduced
pre-media wait and a cached-media authorization defect. It does not certify
physical mobile playback or the first-sound target.

## Identity and observation

- Base: `dd8e9cb56651d3cbb3c09d778491e442256fc395` (`origin/dev`).
- Branch: `fix/mobile-first-sound`.
- Tested implementation: `49b292ef2447a69eedf0911bf335a2670cc2277a`.
  The following commit records documentation and evidence only. A later
  owner-requested copy correction restores the official slogan; its three About
  journeys pass again without changing the playback implementation.
- Owner reports Desktop playback works reasonably well after publication of
  Product 0.1.64, while mobile still loads indefinitely. The installed mobile
  bundle/version and exact blocked phase have not been independently captured.
- No production key, clear recording, signing phrase or payment was requested.
  No infrastructure or deployment change is made by this correction.

## Reproduced defects and correction

A Free encrypted selection first awaited `runtimeReader.canAccess`. In Product
this can initialize/query the Host chain client. The API then independently
checks the canonical release and current on-chain Free policy before releasing
its content key. The first wait had no deadline and happened before 0.1.64's
post-authorization media deadline. A held RPC regression reproduces no key
request and no playback; after removing that redundant read, the authorized
key request proceeds and the real synthetic AAC plays.

Only encrypted v3 Free releases with a release identity and configured key
service take this direct path. Other policies and unencrypted managed sources
retain their client access checks. There is no CDM-to-RPC fallback, extra wallet
request or change to server policy. A stale catalog label cannot grant a key.
The current selection's UI remains unconfirmed until an authorized source is
available; late or cancelled work cannot replace a new selection.

The decoded-Blob cache also returned before key authorization. A regression
that allows playback, denies the next Free-key request and reselects the same
track demonstrated continued playback before the correction. Cached media now
requires the ordinary key path or an eligible existing prepared grant. Denial
leaves playback stopped; granting access again reuses the selected track's Blob
without downloading its ciphertext again. Existing short-lived prepared-source
adoption remains unchanged; material already delivered cannot be recalled.

Keeping the duplicate read with a timeout would retain unnecessary work and
could reject a Free request that the authoritative service can safely answer.
Removing the key check would be unsafe. Consolidating this Free decision at the
existing key service avoids both outcomes.

## Finding the running version

The owner could not find Dotify's version in the mobile app. **You → About
Dotify** now exposes it without a wallet or debug-panel flag. The Product value
comes from the embedded manifest version; ordinary Web shows its build SHA.
Technical details and an allowlisted copy action expose the build/clean state,
selected audio capability path and whether ManagedMediaSource exists. Existence
is explicitly not described as use. Clipboard refusal leaves selectable text
and a screenshot fallback. No account, page URL, session, CID, key or listening
history is copied. Polkadot App's own version is not guessed from the SDK.

This entry is part of the proposed client correction, not a feature remotely
added to the previously published executable.

## Where the first sound actually waits

```text
Choose Free release
  -> API canonical release + current chain policy + key derivation
  -> authenticated manifest, init and encrypted segments
  -> local decryption / native media readiness
  -> audible output (requires physical confirmation)
```

Publication custody and encoding are outside this listening path. Public API
replicas are alternatives, not sequential hops. PostgreSQL participates in
shared trust state and catalog checkpoints. The media relay adds a network hop
when used; configured edge delivery can bypass it for ciphertext, never keys.
Client and relay fallback loops both contribute to an unsuccessful fetch's wait.

The largest known mobile limitation is explicit in `streamingPlayback.ts`:
without standard AAC `MediaSource`, it downloads/authenticates the entire
96 kb/s rendition before creating a Blob. Next-track encrypted standby is also
disabled on that path. The public Back to Kemet manifest inspected here describes
156.6 seconds, 40 media segments plus init, and 1,960,648 encrypted bytes at
96 kb/s. That is 41 sequential object reads after the manifest, before a
playable source exists on the compatibility path.

This code does not implement `ManagedMediaSource`. WebKit documents iPhone
support from Safari 17.1, with an AirPlay alternative or remote playback disabled
as a condition. Support in the actual Product webview must be inspected rather
than inferred from the OS version. A proper adapter also needs streaming demand,
buffer lifecycle, cancellation and actual audible tests; replacing a constructor
name alone is not a defensible mobile fix.

Primary references: [WebKit Safari 17.1](https://webkit.org/blog/14735/webkit-features-in-safari-17-1/),
[WebKit media sources and AirPlay](https://webkit.org/blog/15036/how-to-use-media-source-extensions-with-airplay/).

## Delivery and cost evidence

Read-only operator HTTP probes, one sample each, on October 28:

| Public request | Result | Elapsed |
| --- | --- | --- |
| API `/api/media/QmNtaxo36kon9yMt6rceN9XPzbDBebftEcZfpmzmnWtaHb/stream/manifest.json` | 200, 17,035 bytes | 0.208 s |
| Dedicated Pinata gateway, same CID `/manifest.json` | 403 | 0.226 s |

The gateway is `chocolate-selected-ocelot-159.mypinata.cloud`. Its earlier W33
record reported 401; this sample remains unusable, with a different status.
These are operator-network HTTP samples, not mobile first-sound measurements,
percentiles, or proof of CORS behavior. W33 edge activation remains open (#288).

W36's two warm public replicas, private custody and managed PostgreSQL were
accepted for resilience, shared replay protection, revocation and publication
isolation. The earlier approved estimate was approximately USD 60/month
additional infrastructure, including USD 40.80/month for PostgreSQL, excluding
traffic/taxes. This audit did not inspect an invoice or reprice that estimate.
No current total or savings figure is claimed. Measure actual billing, egress,
load and replacement recovery before changing the topology.

W34's local approximately 40 ms synthetic key-wait reduction concerns prepared
next-track access, not a measured cold first audible output. W36 recovery tests
and W37 bounded indexing likewise do not establish faster cold playback.

## Sovereignty and simplification candidates

Artist runtimes govern rights and value; IPFS content addresses and DotNS make
artifacts independently addressable. Key delivery and public catalog
availability still depend on the Dotify operator. The encryption format does
not decentralize custody by itself. Neither extra replicas nor the Product Host
remove that dependency. Documentation must state this plainly.

These are proposed follow-ups, not newly approved migrations or rewrites:

1. **Listening startup Module** (`useCatalog`, `usePlayback`, key service,
   streaming playback). Its **Interface** currently exposes access, source and
   media-ready states across hooks; the **Implementation** duplicates one Free
   verdict and distributes deadlines. Removing that verdict is the current
   correction. Further **Depth** would concentrate startup ownership behind the
   existing media **Seam**, with separate standard-MSE, managed-MSE and bounded
   Blob **Adapters** only where supported. **Leverage**: one coherent retry and
   cancellation behavior. **Locality**: regressions test the listening journey
   instead of duplicating orchestration. No new interface is proposed here.
2. **Ciphertext delivery Module** (`streamingTransport`, gateway resolver, API
   media relay). Its **Interface** exposes retries at multiple levels; its
   **Implementation** can cascade failures before first sound. Increase
   **Depth** by agreeing one end-to-end attempt budget at the existing delivery
   **Seam**, comparing direct-edge and relay **Adapters**. **Leverage**: bounded
   failure and fewer unnecessary hops. **Locality**: cold/warm/failing delivery
   evidence in one place. First resolve the existing gateway's refusal; do not
   buy another layer before measuring. Authentication remains mandatory.
3. **Pilot deployment Module** (Fly API/custody/encoder configuration,
   ADR 0035). Its operational **Interface** includes scale and recovery promises;
   its **Implementation** currently runs two public replicas. Assess whether
   one warm edge is enough for the internal pilot at the deployment **Seam**.
   One-/two-edge **Adapters** must keep the same shared trust state. Useful
   **Depth**, **Leverage** and **Locality** here mean a rehearsed, understandable
   deployment/recovery procedure, not fewer boxes at any cost. Do not remove
   PostgreSQL or restore pre-W36 local state: revocations, replay protection and
   quotas must survive. This candidate needs measured cost and recovery results
   plus owner approval before changing live capacity.

No candidate changes the artist's policy or introduces a new media format.
The recommendation is startup first, delivery second, capacity decisions from
billing/load evidence. Physical mobile reliability precedes further features.

## Validation and remaining gate

- Baseline WebKit: both new playback regressions fail against the preceding
  implementation (no Free-key request during a held runtime read; cached Blob
  still plays after a new key denial).
- `npm run test:audio-continuity`: **60 passed** in Chromium/WebKit (2.3 minutes),
  including cancellation, denied keys, compatibility playback, preserved policy
  checks, retries and standby adoption. The selected-track download assertion
  excludes independent next-track ciphertext prefetch.
- `playwright test e2e/about-dotify.spec.ts --workers=2`: **3 passed**. Anonymous
  access, embedded version, allowlisted copying, refused clipboard, narrow layout,
  Escape/focus restoration and Back dismissal are checked. Mobile/desktop
  screenshots at 390/1280 px were visually inspected. Their 0.1.28 is the existing
  synthetic test version, not a claimed published candidate.
- `npm run test:unit`: **1,027 passed**, before the isolated About addition.
- Final Web build/typecheck, frozen Product build and lint pass. Lint retains
  two existing App.tsx dependency warnings. Builds retain existing large-chunk,
  Browserslist-age and third-party annotation warnings.
- Offline backlog validation, local documentation links and `git diff --check`
  pass. The production deployment, bills and physical mobile output are not
  validated by these checks.

Browser fixtures generate encrypted synthetic AAC and exercise the real
player/hooks; network policy/Host stalls are controlled, not a physical Host
reproduction.

Publish a reviewed candidate separately, identify the actual mobile executable,
and capture cold Free, authorized protected and denied playback. Record key
wait, first segment, compatibility/progressive path, native readiness and the
moment sound is heard. Check cancellation, replay after denial, background and
resume. #88 remains open until that device evidence exists.
