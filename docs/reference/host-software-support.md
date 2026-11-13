# Host software in support reports

On a client carrying this candidate, opening **You → About Dotify** in a
Product-enabled build starts one best-effort `system.info` read through the
already pinned SDK. It asks for public Host software labels, not an account,
permission, balance, payment or signing operation. Ordinary Web builds with Host
mode off make no read. No SDK or protocol pin changes.

This reference is for developers and operators interpreting a report. The
software labels are Host-reported, not attested identity, a negotiated wire-schema
fingerprint or proof of payment capability. In particular, the Host-native
`version` is not necessarily a TrUAPI/runtime version. `featureSupported` in the
pinned Host SDK exposes only `Chain`; a constructed payment manager or a successful
handshake cannot enable CASH. See the [CASH decision](../design/product-cash-tip-decision-2026-11-13.md).

## Report fields

**Technical details** displays the software labels when available. **Copy app
details** includes that same public row, without listening observations.
**Copy support report** adds an optional `hostSoftware` object to the existing
`dotify.audio-diagnostics.v1` JSON. Inline failure reports without an About
observation omit it. Clipboard refusal retains the existing selectable report.

| Field | Meaning and limit |
| --- | --- |
| `status` | `pending`, `reported`, `unavailable` or `timeout` |
| `platform` | Only for `reported`: `Web`, `Android`, `Ios`, `Desktop`, `Cli` or `Unknown` |
| `name`, `version` | Only for `reported`: nonempty, trimmed software labels, at most 80 UTF-16 code units each; letters/numbers and limited ordinary separators |

The collector and serializer reconstruct only these fields. Unrelated properties
are not traversed, and no account, product context, URL, raw response/error or
payment state is exported. Invalid/control-character/URL-like labels become
unavailable instead of withholding the rest of the report. These fields describe
what a compliant Host reports about its software; they do not authenticate that
Host or authorize access/value flows.

## Lifecycle and resource bounds

- The read starts only while About is explicitly open in a Product-enabled build.
  Opening About does not copy or transmit the support report.
- The result is component-local page memory. Closing About retires the observation;
  reopening starts a new read. It introduces no persistent cache, analytics,
  polling or background retry.
- The caller waits at most **1,500 ms**. A report can be copied immediately with
  `pending` or `timeout`; clipboard export never awaits the optional query.
- There is **one outstanding SDK lookup/info request**, with no queue. A timed-out
  or cancelled request keeps its slot until the SDK settles, preventing repeated
  About opens from accumulating native work. A busy reader reports unavailable.
- Closing About or reaching the deadline aborts only this request's signal. The
  shared transport is never disposed. SDK cancellation may await Host acknowledgement;
  late results cannot update a closed or superseded observation.
- An unsupported/missing/error response is unknown availability, not evidence
  that a capability is absent. No raw Host error is stored or shown.

Only an explicit copy exports a point-in-time snapshot. A later software reply
cannot rewrite already copied text or a displayed clipboard fallback. Reloading
still loses listening observations; freshly read software labels cannot recover
the failed attempt's audio/artwork history.

## Acceptance boundary

Generated SDK/transport and browser fixtures verify the read path, privacy,
timeout/cancellation and existing account behavior. Actual `system.info` support
and reported labels remain to be collected on named Desktop/mobile distributions
after matching delivery. A failed optional read must leave playback and accounts
usable. Keep physical Pause/lock/artwork checks separate from software reporting;
CASH still needs verified units, durable status and artist-controlled settlement.

Scope: [Product compatibility #85](../backlog/polkadot-product-readiness-and-killer-dapp-roadmap.md).
This candidate performs no deployment, funded trial or independent recovery.

Validation: [dated local evidence](../backlog/implementation/evidence/host-software-support-2026-11-13.md).
