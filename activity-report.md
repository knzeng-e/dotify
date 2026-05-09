# Dotify Activity Report

Last updated: 2026-05-09

This file records product and architecture reflections that affect Dotify's
implementation direction. It is intentionally written as a decision log rather
than a changelog.

## 2026-05-09 · Bulletin Chain Role And Account Coherence

### Context

The current Dotify web app uses two account domains:

- an EVM/H160 account for Asset Hub EVM contracts, artist runtimes, track
  registration, royalty payments, and access checks;
- a Substrate/SS58 account for Bulletin Chain metadata publication.

Passkey login derives both accounts from the same WebAuthn PRF root, but they
are still two different technical accounts. Extension login currently pairs a
Substrate extension signer with `window.ethereum`, which may or may not represent
the same user identity. This creates UX and product friction.

The current Bulletin Chain use is optional metadata publication:

- the track manifest is already pinned to IPFS through Pinata;
- Bulletin receives a compact JSON manifest when enabled;
- publication requires a Substrate signer with TransactionStorage
  authorization;
- authorization/renewal is account-bound and therefore becomes an operational
  UX concern.

### Assessment

For the current music publishing MVP, Bulletin Chain adds more user-facing
weight than it removes:

- users must understand why one app needs both EVM and Substrate accounts;
- publishing can fail because the Bulletin account is not authorized even when
  the actual music registration path is otherwise ready;
- authorization renewal is another lifecycle to explain and monitor;
- the manifest is already available through IPFS and referenced on-chain;
- the core rights model lives in the EVM artist runtime, not Bulletin.

Removing Bulletin from the default artist flow would substantially simplify the
account model:

- one primary user-facing wallet: the EVM account;
- one address for artist runtime ownership, royalties, payments, and access;
- fewer signing prompts;
- no Bulletin authorization preflight during publishing;
- simpler support and recovery language for passkey users;
- fewer failure states in Artist Studio.

### Limitation if Bulletin is removed from the default flow

Removing Bulletin from the default publish flow means Dotify loses:

- an independent Polkadot-native metadata availability layer;
- a concrete demo of TransactionStorage from the artist publishing path;
- a possible immutable audit record for release manifests;
- a direct reason to ask users for a Substrate signer in the MVP;
- Bulletin/DotNS continuity if the same mechanism is also used for web app
  distribution.

These losses are acceptable for the MVP if IPFS metadata is the canonical
metadata reference and EVM runtime state remains the source of rights truth.

### Recommended direction

For MVP:

1. Make IPFS metadata canonical.
2. Make Bulletin metadata publication disabled by default or move it to an
   "Advanced / archival" option.
3. Do not require a Substrate wallet for the normal artist publish flow.
4. Treat the EVM account as the primary Dotify identity for listeners and
   artists.
5. Keep Bulletin/DotNS for application distribution if useful, because that is
   an operator concern rather than an artist/listener UX concern.

For production:

1. If Bulletin remains, use a service account or backend worker for optional
   archival writes instead of asking every artist to manage Bulletin
   authorization.
2. If users must sign Bulletin transactions, add explicit account-linking:
   Substrate account signs a link statement, EVM account signs the reciprocal
   link statement, and Dotify stores the pairing.
3. Show account capabilities separately: `Rights wallet` for EVM and `Archive
   wallet` for Bulletin.

### Better Bulletin-aligned use cases

Bulletin Chain could be more relevant if used for low-friction, append-only
statements rather than mandatory publish metadata:

- public release announcements for official artist drops;
- signed artist activity journal: release created, metadata updated, rights
  transferred;
- listening room session receipts: room opened, track shared, host identity,
  timestamp;
- transparency feed for royalty/payment events aggregated from EVM logs;
- Dotify app distribution through Bulletin + DotNS as an operator-controlled
  deployment channel.

The best near-term fit is "operator-controlled app distribution" and optional
"official release announcement" snapshots. The weakest fit is requiring every
artist publish flow to depend on a user-managed Bulletin authorization.

### Account management implication

Without Bulletin in the default path, Dotify can present a cleaner model:

- passkey creates one visible Dotify wallet: the EVM rights wallet;
- extension mode primarily requests an EVM provider;
- Substrate account becomes optional and only appears when the user enables an
  archival/Bulletin feature;
- listener access checks, payments, artist runtime ownership, and royalties all
  use one address.

This improves onboarding and reduces accidental account mismatch. It also makes
the passkey story easier: "your passkey controls your Dotify wallet" instead of
"your passkey derives two chain accounts with different responsibilities."

### Proposed product decision

Move Bulletin out of the core publishing path for MVP. Keep it as:

- optional archival metadata publication;
- operator-controlled app deployment / DotNS distribution;
- future transparency or activity stream if the use case becomes clearer.

Do not require Bulletin authorization for artists to publish tracks.

### Implementation follow-up

The simplification path has been implemented in the frontend:

- wallet extension login now requests an EVM provider first and no longer
  requires a Substrate extension account for normal Dotify use;
- passkey login still derives a Substrate signer, but that signer is only used
  when optional Bulletin archival is enabled;
- Artist Studio disables Bulletin archival by default;
- the track manifest pinned to IPFS is the canonical `metadataRef` sent to the
  EVM runtime;
- if Bulletin archival is manually enabled without a Substrate signer, the app
  blocks submission before the on-chain registration step and explains that the
  user can disable the option or use a passkey wallet.
