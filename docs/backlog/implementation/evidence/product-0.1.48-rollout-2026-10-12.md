# Product 0.1.48 rollout evidence — 2026-10-12

## Candidate identity

- Implementation: [#270](https://github.com/knzeng-e/dotify/pull/270); release identity: [#271](https://github.com/knzeng-e/dotify/pull/271).
- Source SHA: `fc7faf5a49e6d5b3392285bab2ee957d325b4cb6`.
- Product appVersion: `[0, 1, 48]`; runtime profile: `product-cdm` on `devnet`.
- Executable CID: `bafybeicqj4ekyiz7pmbt7ry2ixpwvpa24v5liialmhe3zwonjslt47wvna`.
- Rollback Product: 0.1.47 at `bafybeiht6sq4c3ehc3oku7fbvuonq3hbywnnwot6c5wf4jyi5pjgdgmv74`.

The release coordinates publication reconciliation, public artwork reuse,
automatic host-tip association, verified native room announcements and the
release editor. The editor's additive runtime module is **not activated** by
frontend publication. Issue #269 stays open through that activation and physical
acceptance. No contract write or funded tip was part of this rollout.

## Automated and deployed evidence

Merged `dev` passed every quality gate in
[run 38187323596](https://github.com/knzeng-e/dotify/actions/runs/38187323596),
including core browser flows, encrypted audio continuity and Product identity.
The release build used a clean source checkout, the frozen catalog and the
tracked native profile. Live Host Remote Config matched the pinned CLI 0.20.0
and Host-facing DotNS resolver before and after publication.

| Surface/check             | Observed result                                                                                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API image                 | `registry.fly.io/dotify-api@sha256:3219ba08c80c85674c13dac3fbdf6fdd47ab30ac33ed8cd59b1944c0c6c3c014`; machine `802034f6565958`, version 25. `/version` returned the exact source SHA and `/health` returned `ok`.                                                                                   |
| Signaling image           | `registry.fly.io/dotify-signal@sha256:be762e73faa46a0d6d762db3e78ba459f5b96adbb26bf09d77364ac3f8348ce3`; machine `d8d5205f929e28`, version 29. HTTPS/native Product origin smokes passed; a foreign origin was rejected.                                                                            |
| Receipt credential        | Both Fly secrets are deployed with matching platform digests. An in-container signaling request received the trusted 300/minute quota; an anonymous request retained 20/minute. Invalid receipt input was rejected with 400 in both cases. No credential was printed or stored in source/artifacts. |
| Historical native receipt | The already-paid transaction `0x399da77a6aa2d84902f6d8b5a49bb77978604a7cf0e15db4a0d72560b2ae5754` at block `14005675` returned canonical success and two logs. This was a read, not a new payment or chat-announcement test.                                                                        |
| API origins               | Netlify, Product execution HTTPS, mobile HTTPS and the configured native scheme received their exact CORS allow-origin values.                                                                                                                                                                      |
| Netlify                   | Entry `assets/index-tjBOFrVF.js` contained the same source SHA. Chromium desktop/mobile viewports rendered the listening home without uncaught JavaScript errors. The smoke waits for rendered UI, since realtime requests prevent reliable network-idle readiness.                                 |
| Public Product CAR        | Independent gateway read returned 14,643,375 bytes containing the source SHA and `assets/index-Dm8USd7E.js`. The exact CAR was preserved locally for restoration.                                                                                                                                   |
| Finalized DotNS read-back | At block `14323050`, root and `app.dotify-test01.dot` content hashes both matched the executable CID; the executable text record reported `{"$v":1,"kind":"app","appVersion":[0,1,48]}`.                                                                                                            |

The API was activated first, followed by signaling, then signed Product
publication. Netlify's merge-triggered build already served the matching commit
when checked before the backend rollout. There were no active rooms before the
signaling restart. Each backend retains one active machine; origins, storage
mounts and contract addresses are unchanged.

## Bulletin and DotNS transactions

- Stable upload: Bulletin block `1172707`, transaction
  `0x9411bf7120ceec3abbc9b583675b69e4542536b16c562f5b02f3531aea3a2ebd`.
- Full-CAR root: Bulletin block `1172710`, transaction
  `0x75c4d6307ea43c1ef60a644a725fd79c2d2ee41750f9c485689dcb07513ab6d5`.
- All 26 content nodes reached GRANDPA finality; P2P retrieval passed in 48 ms.
- Root content link: Asset Hub block `14323003`, transaction
  `0x90ccee10aec87a975d821081bec1862a20c12ff155b045df8fb2135052cd736a`.
- Atomic executable content/manifest update:
  `0xbcca22b77a870326ff50da9b88dda50b6bd198925479a3d4fc99fd6aacef47d0`.
- The local DotNS signer was removed from `launchd` after publication. The phrase
  was passed only through the child-process environment and never printed.

## Remaining activation and physical acceptance

A read-only census at finalized block `14320426` found all three registered
artist runtimes missing metadata selector `0x100c6f26`; each runtime owner equals
its registered artist. The reviewed facet runtime-code hash is
`0x646a3c7f44c276db425f4ecf73e636b6501803d094d6c5e78aa0a910a6d880ce`.
Deploying this facet and approving an Add cut require separate owner signatures.
The current factory also requires that additive cut on newly created runtimes.
Preserve runtime addresses, paid access, audio, artwork and allocations.

Reopen installed Hosts and capture evidence bound to this SHA/version/CID for:

- delayed publication confirmation without another registration;
- studio-to-listener navigation and cold/warm artwork loading;
- connected/walletless host allocation, one native tip with one chat announcement,
  and finalized recovery without repayment;
- owner-authorized metadata correction and artist/listener read-back;
- room playback and chat on reported Desktop/mobile versions and an independent
  walletless guest;
- matching rollback and restoration, then the consented aggregate W13 pilot.

Pre-rollout backend images remain the rollback boundary: API
`registry.fly.io/dotify-api:deployment-01M4P0WQZB9V4DZV1G1181BG1B` and signaling
`registry.fly.io/dotify-signal:deployment-01M4K1454N8JD5TPAQBNM1KDBG`.
Signaling restart loses ephemeral room/chat/intent links; never repeat a valid
payment to repair its announcement. Publication and transport checks do not
certify these remaining installed-device behaviors.
