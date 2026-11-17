# Protected playback account lifetime — 2026-11-05

Refs W33/#288. The owner has heard the registered eight-second Bulletin release
on Web, Desktop and mobile in [0.1.72](product-0.1.72-rollout-2026-11-04.md).
This follow-up addresses denied keys and account interruption, without another
music publication or any deployment.

## Reproduced boundary and correction

Wallet sign-out already revokes the server session and clears prepared grants.
It did not retire an active local selection: a decoded URL remained attached,
and a key response begun by the old account could finish opening that source
after disconnect. With controlled key/media fixtures, three browser regressions
fail on the old lifecycle: attached source after disconnect, late attachment,
and an old source after switching to another account.

`useCatalog` now records whether a selection depends on an account (a managed
artist release whose mode is not Free). Its existing preparation lifetime is
keyed by connection method, canonical lowercase listener, wallet chain, RPC,
signature scheme and Product public key. Profile labels are excluded. When that
identity changes during preparation or while a protected source is attached:

1. Retire local output synchronously, including its registered Web Audio graph.
2. Abort the selection/producer, clear standby and owned decoded sources, and
   clear the old account's displayed access/paid maps.
3. Show reconnect/recheck feedback while retaining the track's metadata. Late
   callbacks fail the existing selection-current/abort checks and cannot attach.
4. Require explicit action to reopen through ordinary access/key checks. A
   reconnect changes the notice to an access recheck, not an automatic play or
   payment. Stored payment facts and actual on-chain entitlement are untouched.

The effect deliberately leaves already locked selections alone: disconnecting
while the payment explanation is open must preserve its existing hand-off to
one account dialog. Free playback needs no account and retains its current
source; queued speculative work is still cleared. Room guests continue receiving
only the room media stream. A room host's retired local protected source cannot
continue feeding its old Web Audio output; physical room interruption remains
an acceptance check.

This is a client lifetime boundary, not authority to issue a key or a DRM claim.
The server remains authoritative. Previously delivered keys/plaintext cannot be
recalled from another program or recording. A server denial never becomes a
public fallback or a fabricated gateway URL. Existing bounded retries for a
positive client check followed by a service refusal remain unchanged.

## Verification

Controlled fixtures cover runtime denial before any key request, key-service
refusal despite positive runtime readback, disconnect, late key completion,
account/network switch, explicit reconnect/recheck without a second payment,
profile-only refresh and Free preservation. The fixture's entitlement belongs
to one static test listener so a second account cannot inherit its approval.
All extra events require the build-time E2E flag and a Bulletin fixture scenario;
production Web/Product bundles contain none of their event/identity markers.

The key/media and payment adapters are synthetic. These tests prove coordinator
behavior and source attachment/retirement, not live signed-key denial, actual
sound, server revocation timing or network continuity on a phone. Existing
protected-room scenarios check host key ownership and zero guest key requests.
Unit coverage retains failure classification, standby cancellation, streaming
pipeline abort/authentication failure, media-source ownership and transport
cancellation. Local validation: 23 Classic browser scenarios and two protected-room scenarios
pass, including explicit recheck by the unentitled second account and no inherited
key request. Five related unit suites pass (18 tests). Web and frozen Product
builds pass; lint has zero errors and the two pre-existing `App.tsx` dependency
warnings. Build warnings concern existing large chunks, dependency annotations
and outdated Browserslist data. A production-bundle scan finds neither new E2E
event nor alternate fixture-identity markers. No live wallet/key/network write
was made. These are local checks, not physical candidate acceptance.

## Operations and remaining acceptance

No environment, CORS, role, storage allowance, custody state, key, deployment
version or live service changes. Web/Product remain 0.1.72 until a separately
prepared rollout. No signing, storage transaction, payment or renewal is needed
to review this implementation. Existing music/receipts must be reused.

After matching clients are delivered, follow the
[protected playback acceptance procedure](../../../operations/bulletin-protected-playback-acceptance.md)
with the same registered release and existing accounts. Record candidate/version,
device/Host, wallet role and observable results. W33 stays open for physical denied
and interrupted access, representative costs/startup, dependency conservation,
bounded renewal and coherent off-volume recovery. This eight-second buffered
sample cannot demonstrate uncached network/background recovery by itself.
