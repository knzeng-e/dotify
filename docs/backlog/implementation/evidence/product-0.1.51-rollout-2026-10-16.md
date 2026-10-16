# Product 0.1.51 recovery rollout — 2026-10-16

## Published identity

- Application base: `974568c8e42211d757f50178c7de96ca1df087e3`, merged #283.
- Published release source: `cdb9ac245a865d085984b7750728aaaa358757b5`.
- Release record: [#284](https://github.com/knzeng-e/dotify/pull/284).
- Product `[0, 1, 51]`, `product-cdm` on `devnet`, `dotify-test01.dot`.
- Executable/root CID: `bafybeihpprpso6vopekio67surwcygt2ygs6dnppdfsszmiul2qchib2me`.
- Public viewer: `https://dotify-test01.dev-dot.li`.
- Web validation at the time of this rollout observed merged application SHA `974568c` in
  `assets/index-DVB88dbf.js`; no redundant Web deploy was triggered. Product has
  its separate committed packaging identity and frozen 13-item catalog. This is
  dated evidence, not a claim about later merge-triggered Netlify builds; those
  require their own served SHA/config-digest validation. The gateway cleanup is
  already in dev through #282, so #284 adds no Netlify configuration change.

The owner authorized deployment and tests, then reactivated the local signer.
No real user coordinates, funded tip, contract upgrade or permission migration
was used in automated checks. The phrase was never printed or written to a file.
The deployment child received it locally; the wrapper removed the launchd
variable afterward and its absence was verified.

## Validation and rollout

- Reviewed #283 passed [run 38807971747](https://github.com/knzeng-e/dotify/actions/runs/38807971747).
- Exact published candidate passed [run 38814693175](https://github.com/knzeng-e/dotify/actions/runs/38814693175),
  including all Web, API, signaling, contract, Product and browser checks.
- Merged-dev [run 38812588140](https://github.com/knzeng-e/dotify/actions/runs/38812588140)
  initially failed its first-tone WebRTC meter expectation (0 Hz within six
  seconds). The unchanged scenario passed six local repeats; the failed job's
  rerun then passed all stages. This is a recorded transient startup-test
  failure, not proof that every physical audio-start issue is resolved.
- Local candidate passed 943 unit tests, 20 Product guard tests, production
  environment fail-closed smoke, frozen Product build, six live DevNet checks
  and live Host Remote Config alignment with CLI 0.20.0.
- Signaling release 32 uses one machine `d8d5205f929e28`, image
  `registry.fly.io/dotify-signal@sha256:cb3a7ac770a8fc7e767702fbbe8130060499c9d84fe71095cfce789476dc656f`.
- API release 26 uses the existing machine `802034f6565958` and volume topology,
  image `registry.fly.io/dotify-api@sha256:3edd71de45a4f0cb81100aa41ca5928aa1b8de9d40072ed691e2d61d18acf8d7`.
  Its `/version` confirms full source `cdb9ac245a865d085984b7750728aaaa358757b5`.
  Immediate post-deploy reads briefly reached the old process; subsequent reads
  confirmed the new source and fresh uptime before tests/publication continued.
- Both image labels bind the release source. Rollout order was signaling → API
  → Product.
- Netlify API CORS was accepted; a foreign origin received no allow header.
  Signaling accepted the intended origin and rejected the foreign handshake.
- Deployed synthetic host/guest checks passed: private default; 17 km publishing
  and 42 km search; rejection of 43 km; explicit worldwide discovery; disjoint
  geographic/worldwide results; no location in discovery replies; empty legacy
  global enumeration; wallet-free invitation join; chat delivery; invalid token
  classified `SESSION_INVALID`; and immediate visibility opt-out. Test clients
  were disconnected and their own temporary room was explicitly left. Existing
  user rooms were not closed by those smokes. Synthetic coordinates describe an
  ocean-area fixture, not a user's position.

### Restart incident

Initial preparation saw zero rooms/listeners. Two rooms with zero listeners
opened while CI was running. The final pre-switch assertion detected them, but
its shell sequence did not stop the following deployment command; the immediate
signaling restart reset their ephemeral state. A subsequent room reappeared.
The incident was disclosed to the owner; it must not be described as a zero-room
restart. API deployment used fail-fast command handling. Future switch commands
must bind health validation and mutation with fail-fast execution, and recheck
active sessions immediately before any restart.

## Independent publication read-back

All 25 content chunks reached GRANDPA-finalized state. P2P retrieval passed in
55 ms. A public gateway returned HTTP 200 and a 13,908,590-byte CAR containing
source SHA `cdb9ac2`, Product 0.1.51 identity and entry
`assets/index-yJfz-jic.js`.

A separate finalized Asset Hub read at block `14489435` confirmed the content
hash on both `dotify-test01.dot` and `app.dotify-test01.dot`, and executable
text `{"$v":1,"kind":"app","appVersion":[0,1,51]}`.

Transaction references:

- Bulletin stable upload: block `1225962`,
  `0x76c40dab4a6dfccce8ca3bbb322dc45315801feb8b3255dfed380246d430b7ea`.
- Bulletin root upload: block `1225965`,
  `0x9a9de805194bae622297b09fbbcecd182ee85039869bed17cf234b9b247b6784`.
- Root content update: Asset Hub block `14489397`,
  `0xf17832979aa2ac70f7dfb0f7ad271bf226acf6acdab5a0aab506d766657f54ca`.
- Atomic app content/executable update:
  `0x9969620a945e49c322faeb8c0115114330490fca205f1f128fe3d7da52e344df`.

## Live Web checks and remaining acceptance

The actual Netlify build played the free encrypted Mogongo track through its
normal end (232-second track). Observed clock samples advanced monotonically;
no `Audio interrupted` modal occurred. An upstream range request still aborted
in one run, but full-file recovery continued playback without resetting the
clock. This validates recovery in this browser/network, not universal gateway
availability or physical speaker output. A separate real-browser check decoded
Le Singe Fou's actual artwork through the cache (220 × 220) and a screenshot
confirmed the cover rather than the generated fallback. No artist asset was
repinned or replaced.

Reopen installed Desktop/mobile Hosts and verify loaded **0.1.51** before testing
native location grant/denial, a fresh accurate fix, scan completion, mutually
exclusive visibility choices, 5–42 km controls, opt-out/background/reconnect,
artist/account connection and several full tracks in a room. Native approvals,
a paid tip/chat notification and a newly artist-authorized cover upload/read-back
remain physical acceptance checks. No new payment was sent in this rollout.
Refs #274, #88 and #89 remain open where those gates apply.

## Rollback

Retain Product 0.1.50 CID
`bafybeie3r7hmzucvqhmkv5prgt3tguyq2m3fictwgdm7uelm3ssmo6b72m`;
signaling image
`registry.fly.io/dotify-signal@sha256:c4fa0a5f982a7f2146a9e55fb8ab6f29d3c1c76d9b4de5b82f75c1e861cf3c4f`;
and API image
`registry.fly.io/dotify-api@sha256:3219ba08c80c85674c13dac3fbdf6fdd47ab30ac33ed8cd59b1944c0c6c3c014`.
An older server cannot serve worldwide/extended-radius requests, but this
0.1.50 signal still preserves private default. Never restore the earlier global
enumeration server while promising private discovery. Restart clears ephemeral
room/chat/intent state; preserve the API volume and never repeat a paid tip to
repair an announcement. No new secret, CORS origin, service or mount was added.
