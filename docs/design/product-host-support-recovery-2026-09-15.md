# Artist support from Polkadot App

Scope: #156 / W12 and #85 / W11 follow-up, from `dev`
`ee695caeaf18f4ce52f5ea71f48b8204d909162b`. This pass completes the existing
Classic purchase/support journey and adds [optional direct artist gifts](artist-gifts-2026-09-16.md). It adds no contract or CASH rail.

## The listening journey

A listener reviews the amount, recipients and listening conditions, then asks
their wallet or Polkadot App to confirm. The displayed amount uses the runtime
integer price when present, matching the value sent. Existing paid access is
checked first, so returning to a track does not ask for another payment.

The Product adapter passes the native value through `musicRoyPayAccess` with
`waitFor: 'finalized'`, supported by the installed SDK's `TxOptions`. It still
verifies the approved Product public key and derived H160 against the connected
account. An initial setup failure no longer poisons the cached writer promise;
the next explicit attempt reconnects, releasing the failed manager.

After confirmation, fresh `hasPaid` and `canAccess` reads gate paid playback.
This does not claim that every collaborator has already received funds:
settlement can be immediate or claimable under the existing royalties contract.
A title already available without paid access opens without sending support.

## Interruptions and recovery

`createSupportPaymentFlow` owns submission/recovery independently of React.
`useCatalog` owns account/view checks, feedback and opening the selected track.
The same coordinator runs in browser tests with deterministic read/write ports.

- Overlapping taps share one operation; the UI also guards the asynchronous
  preparation before the flow starts.
- A tab-local reservation is saved **before** requesting a signature. A returned
  hash and the requested native amount/symbol replace it. It survives reloads.
- A proven signing rejection or pre-submission writer setup failure allows an
  explicit new attempt. Broad words such as “denied” do not prove cancellation.
- A timeout or unknown outcome retains the reservation/hash. Reopening that
  track checks the existing attempt; it cannot automatically submit another.
- **Check access again** invokes only read ports. It never creates a writer,
  prompts a signature, waits through writer setup or sends money.
- Changing the connected account prevents cached rights or playback being
  applied to the new account. The recovery callback also checks its original
  account; it cannot silently use a stale account closure.
- Audio loading failure after verified support remains an audio error. The
  receipt stays available and reopening the track does not repay.

## Storage and trust boundaries

`sessionStorage` entries use `dotify.support.v1:` keys scoped by adapter/RPC,
account, runtime address and track hash. Values contain version, requested
native amount/symbol and an optional transaction hash. No content key, private
key, signature, username or listening history is stored or sent to a server.
They are recovery hints, never access authority. Invalid/unavailable storage
fails before a new payment; a post-submit write failure retains the hash in
memory and leaves the earlier reservation on disk.

A fresh read proving paid access can recover listening even if the host failed
to return a hash. It does not prove that the interrupted attempt was the one
that granted access. A stored amount is the requested amount; actual settlement
remains verifiable from the chain. Existing access without a saved attempt is
shown without inventing a receipt amount.

The journal is scoped to this browser tab. It is not a cross-device lock and is
lost when the host destroys tab storage. The runtime's existing “already paid”
check remains the final duplicate-payment boundary. Unknown submissions stay
conservative, including a runtime failure whose final state cannot be proven
through the current write port. Check host/account activity before attempting
support elsewhere. No automatic financial retry or journal-expiry retry exists.

## Product build and remaining device evidence

`npm run build:product-devnet:support` explicitly selects the existing
`VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm` flag and enables the optional
`VITE_DOTIFY_ARTIST_DONATIONS=on` flow. Ordinary web and the tracked
Product profile keep their existing adapter choice. This is a build command,
not a deployment command. It normally regenerates catalog bootstrap data; local
validation instead runs TypeScript and Vite with the flag while preserving the
checked-in snapshot.

Before promoting this profile: capture a real Polkadot App approval, forwarded
native amount, final transaction, fresh paid/access reads and protected-key
opening with the same account. Repeat rejection, delayed confirmation, reload
and account switch. Capture native explorer compatibility as part of the
receipt check. Use the existing W11 evidence exporter; no money or deployment
was authorized/executed for this implementation validation.

CASH, claims of perpetual access, automatic wallet fallback
and smart-contract changes are outside this pass. All native payment evidence
remains distinct from mock/browser test evidence.
