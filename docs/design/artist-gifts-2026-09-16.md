# Direct artist gifts

Scope: requested companion to the W12/W11 support recovery pass. Build flag
`VITE_DOTIFY_ARTIST_DONATIONS=on`, off by default. No new contract or deployment.

## User journey

From a public artist profile, **Give to the artist** opens an amount-of-choice
form. Dotify re-reads the selected release before naming its receiving artist.
The review shows amount, currency, recipient, additional network fees and an
expandable full receiving account. Only **Confirm gift** requests a signature.
A confirmed gift has its own receipt. It never sets `hasPaid`, requests a content
key or changes listening access. Release royalty splits do not apply to gifts.
Music stays mounted while the standard accessible dialog is open.

A profile groups releases by display name, which is not a unique identity. The
quote is deliberately bound to the profile's lead release and identifies that
release beside the full receiving account; names are not payment destinations.
This is publication provenance, not a verified legal identity or artist badge.
A future account-based artist route can remove name collisions across releases.

## Authority and transfer paths

`resolveDonationArtist` checks the runtime address, finds the exact release hash
in fresh runtime records, and requires an active release with a nonzero artist
account. It never trusts an arbitrary recipient from catalog display metadata.
A missing/invalid record or unavailable read fails before payment preparation.

`ArtistDonationButton` owns form/review/account guards. `createDonationFlow` owns
the submission reservation and recovery. `DonationPort` separates two paths:

- Standalone: viem reads the actual chain's native currency, gets the active
  connected account and network, estimates gas, then sends a plain value
  transfer. Receipt verification checks success, sender, recipient, amount and
  empty calldata. A reference from an unrelated transaction cannot mark success.
- Product: the installed DevNet descriptor supplies the native chain client.
  Chain properties supply native decimals and symbol. `Revive.OriginalAccount`
  resolves a native artist's H160 to its original account; only unmapped accounts
  use the SDK's EVM-derived `h160ToSs58` fallback. A round trip must reproduce the
  artist H160. The existing Product signer manager checks the approved public
  key and H160. `Balances.transfer_keep_alive` uses native units and SDK
  `submitAndWatch(..., {waitFor: 'finalized'})`. A failed dispatch never becomes
  a success receipt. The manager/client are released when finished/dismissed.

Native Balances precision is independent of the 18-decimal EVM value used by
Classic contract access payments. No decimal rounding, hidden signer, EVM
fallback for Product, or change to the royalties contract is introduced.
The direct `@parity/product-sdk-tx@0.4.7` dependency matches the already installed
SDK transitive version; its real typed API is checked by TypeScript and CI.

## Recovery boundary

A `dotify.gift.v1:` session entry is reserved **before** signature approval, scoped
by chain identity, sender and recipient. It contains the amount and, when
available, hash. Overlapping clicks share one promise. Proven cancellation or
pre-submission preparation failure releases the reservation. Ambiguous failures
retain it. Recovery with a known EVM hash reads that original transfer, using its
original amount, and does not submit another gift. A successful receipt removes
the entry so a later intentional gift remains possible.

For a native Product interruption without a returned hash, the UI asks the user
to inspect Polkadot App activity. It cannot infer a gift from an access grant or
a balance change. The current SDK wrapper returns a hash only at finalization;
there is no invented native-history lookup or automatic retry. Such a pending
reservation conservatively blocks another gift to that artist in this tab.

This is a same-tab reload protection, not an exactly-once or cross-device
protocol. Clearing session storage, closing a host tab, or using another device
removes this client protection. Direct transfers have no contract idempotency
key. Inspect unresolved activity before sending elsewhere or clearing storage.
No private key, signing payload, content key or donor social history is stored.
Unknown native outcomes and reverted EVM receipts need a future verified outcome
adapter before a safe retry affordance can release them automatically.

## Rollout and validation

`npm run build:product-devnet:support` enables both Product CDM and gifts.
CI additionally compiles this profile after the strict offline catalog fixture.
Ordinary deployments keep the existing adapter and gifts off. Roll back by
rebuilding without the donation flag; no service or data migration is needed.

Automated tests cover exact amount parsing, canonical recipient selection,
account/network changes, rejection, delayed receipt recovery, reload, double
clicks, native mapping/finality/cleanup and gift/access separation. Browser
fixtures never send money. Mobile/desktop Chromium and WebKit check the review,
receipt and interrupted-confirmation UI.

Before enabling a real host rollout, verify a small approved DevNet gift on a
physical Polkadot App device: same sender, mapped native recipient, exact native
amount, fees, final receipt, and unchanged paid access. Repeat cancellation,
account switch and interrupted confirmation; compare the receipt to host activity.
Also validate a standalone wallet transfer. No real signature, funds, manual
deployment or smart-contract modification is part of this implementation pass.
