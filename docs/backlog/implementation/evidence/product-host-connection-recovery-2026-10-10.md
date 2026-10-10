# Product Host connection recovery

- Scope: compatibility epic #85; connection incident after Product 0.1.44.
- Starting dev: `d60b20bbf05433d3068606d501375cc3582db0c6`.
- Owner report: connection timeout on Desktop 0.1.3 and mobile 0.10.0.
- Candidate: Product `[0, 1, 45]`, not yet published.

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

## Remaining acceptance

Publish the reviewed 0.1.45 candidate, confirm the loaded version/SHA on Desktop
0.1.3 and mobile 0.10.0, then connect and sign for protected playback. Keep #85
open until those device results are captured. The 0.1.44 artifact remains the
currently published bundle until the new publication completes. Future Product
family upgrades require wire tests plus actual supported-Host smoke evidence.
