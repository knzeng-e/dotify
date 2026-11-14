# Free-track buffering and Room preparation — 14 November 2026

## Observed failure

The owner reports interrupted solo listening and unsuccessful Room creation with
Adang Fobe, wallet disconnected, on Polkadot App iOS 0.10.0 (20), client 0.1.84
`2f6c5cda299b9abb46c18c049e6bea218b4f0ffa`. This followed the server delivery
from `91f25c77`; timing alone does not establish that delivery caused the fault.
Earlier short-lock acceptance does not cover this failed journey.

The supplied `dotify.audio-diagnostics.v1` report (observed
2026-11-14T06:48:48.440Z) shows:

- Room key authorization succeeds in 305 ms and 179 ms. A missing wallet is not
  the blocker for this canonical Free track.
- Solo repeatedly waits at nominal four-second AAC boundaries with readyState 2
  while its AudioContext stays running; new bytes restore readyState 4/playing.
- Room attempts reach segment 27 at 57.981 s, segment 38 at 55.566 s and segment
  52 at 53.233 s, with no compatibility-ready event. The trace is consistent with
  exhausting the 60-second post-authorization preparation budget. The old report
  suppresses the terminal cancellation, so it does not itself prove each exit reason.
- Artwork composition/publication takes 24 ms in this attempt. Explicit pause
  remains set through the later recorded visibility changes.

A bounded public catalog read identifies this release as the legacy UnixFS/IPFS
streaming path, not a Bulletin pack. Public API ciphertext probes returned early
objects in 159–350 ms and one later object in 5,117 ms. Cache state and network
conditions are uncontrolled; this is not a before/after benchmark or an attribution
to a particular upstream gateway. No key, clear audio or private server log was read.

## Candidate correction

Based on tested dev `855ad7a34a2878907550707762359883b1017b15`, the client overlaps
two managed segment reads, preserves native-demand/seek/append ownership, prioritizes
solo relay reads and reuses bounded ciphertext across Room retries. It also reports
the Room deadline explicitly and removes the misleading access suggestion for an
authorized timeout. The reusable behavior and limits live in
[Continuous listening](../../../explanation/continuous-listening.md#adaptive-delivery).

No server configuration, access policy, key, musical asset or deadline is changed.
The research finalization wrapper follows the same split read/append interface.
This is a candidate, not a deployed or physically accepted fix. A genuinely cold
full rendition on a sufficiently slow connection can still exceed the deadline;
the compatibility capture architecture still needs that full rendition on iOS.

## Verification and next gate

The implementation commit and exact validation results are recorded in its PR.
Deterministic regressions exercise out-of-order slow reads, two-read bounds,
seek/stop cancellation, eviction and append completion, ciphertext size/age limits,
solo priority, authorization-versus-timeout copy and redacted timeout reporting.
The cold-cache browser setup now expires the five-minute cache explicitly.

After reviewed Web/Product delivery, repeat an existing Free track with no wallet:
cold solo listening, one Room preparation, Pause during preparation, audible
Web/Desktop guests and short phone lock. Export diagnostics before retrying on
failure. Compare cached and cold preparations separately. Keep #395 open; do not
infer native audio or startup performance from synthetic tests alone. No new
publication or payment is needed for this acceptance.
