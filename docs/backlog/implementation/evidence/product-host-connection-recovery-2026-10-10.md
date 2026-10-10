# Product Host connection recovery

- Scope: compatibility epic #85; connection incident after Product 0.1.44.
- Starting dev: `d60b20bbf05433d3068606d501375cc3582db0c6`.
- Owner report: connection timeout on Desktop 0.1.3 and mobile 0.10.0.
- Published release: Product `[0, 1, 45]`.
- Source: tested `dev` merge `b45c2f700c2c36eed06d23dad2ea51c917842c80`.

## Finding and recovery boundary

The deployed 0.1.44 lockfile selects TruAPI 0.24.0, whose generated client
declares codec 3. The preceding 0.1.43 graph selects TruAPI 0.13.1, codec 1.
Their frame envelopes differ: codec 1 addresses a request/response by a single
discriminant; codec 3 uses trait, method and message-type bytes. A successful
SDK fake-client test cannot establish compatibility with that wire channel.

Restore the complete prior Product family (SDK 0.27.0, Host 0.19.1,
descriptors 0.11.0, Statement Store 0.6.9, tx 0.4.7) and explicitly override
TruAPI to 0.13.1. Preserve application behavior, product account derivation,
signing/access checks and the listening-session changes. Bump appVersion to
0.1.45 for Host refresh. Prefer this coherent recovery graph over mixing old
transport codecs into a newer SDK whose request schemas changed. No automatic
identity fallback, new signer, contract write or server migration is introduced.

The exact protocol exposed by the owner's installed Hosts has not been captured.
The codec skew is the leading diagnosis, supported by the timing of the incident
and transport tests, rather than a completed physical-device reproduction.

## Validation

- Two fixed raw codec-1 handshake samples pass against the restored installed
  transport, covering both Host-initiated and product-initiated negotiation.
- The same tests fail against the deployed codec-3 package (0/2 pass), detecting
  the wire mismatch that SDK-injected fake clients missed.
- Journey and CASH readiness tests plus wire tests: 42 passed.
- Frontend unit suite: 107 files / 847 tests passed.
- Ordinary build and frozen Product build passed; existing chunk-size warnings
  remain.
- Simulated Chromium identity flow: 5/5 passed. This supplements the wire tests
  but is not a real Desktop/mobile observation.
- Deployment guards: 18 passed, including the wire tests; journey: 31 passed,
  zero failed, live evidence correctly blocked/not run.
- Lint passed with two existing App hook warnings; offline backlog consistency
  and whitespace checks passed.
- Runtime audit: 30 findings (1 moderate, 29 high, zero critical), compared with
  31 in the October 9 snapshot. Existing Product/PAPI advisories remain; no
  forced dependency migration was applied.

## Publication evidence

- Executable/root CID:
  `bafybeicrl7vkxowvwddmptksezhzvop7xwxl7mwk6ptoxxtdwsmfn5mcfq`.
- Bulletin stable upload: finalized block `1156565`, transaction
  `0x7d8ece12c78b1a0540b758f08a78c576c9ed74e539ec690e5c928fee4197f0a9`.
- Bulletin full-CAR root: finalized block `1156568`, transaction
  `0x3f6a39805b3d273320a08ea2ac5b66ce8980509dd9300c3153c448edf57e6680`.
- Asset Hub content link: finalized block `14262803`, transaction
  `0x8047c3404e54d4e991b3eebe7284c8ae9a69824c1f3615ab2410a3bd48676da8`.
- Atomic executable manifest update:
  `0x5ec4f5f72bc55d9eeea7174f1b6c9b7db6e6976318fe9b91f7185687d8b5adf4`.
- All 14 chunks reached GRANDPA finality; deployer P2P retrieval passed in
  1,857 ms.
- Remote Config matched the pinned DevNet registry and content resolver before
  and after publication.
- The public wrapper resolved on `dotify-test01.dev-dot.li`, loaded the
  `dotify-test01.app.dev-dot.li` application frame, displayed the catalog and
  reported no page or console errors.
- The coordinated signaling release passed health and origin smokes for the
  public web and Product URLs. The API and contracts were not redeployed.

## Remaining acceptance

PR review follow-up: CASH readiness now shares the journey harness's expected
SDK versions. A real-lockfile/runtime-port test also exposed and corrected a
stale exact-string signature check that rejected the optional payment observer.
A negative test still refuses the broader non-executable intent type. Combined
journey/CASH/wire tests: 44 passed; the actual CASH readiness command has zero
failed static gates and retains the external settlement-authority block.

Reopen Dotify in Desktop 0.1.3 and mobile 0.10.0, confirm loaded Product version
0.1.45 and source SHA `b45c2f700c2c36eed06d23dad2ea51c917842c80`, then
connect and sign for protected playback. Capture room creation/joining and the
presence/chat paths on both supported Hosts. Keep #85 open until those physical
device results are recorded. Version 0.1.44 is the rollback artifact. Future
Product family upgrades require wire tests plus actual supported-Host smoke
evidence.
