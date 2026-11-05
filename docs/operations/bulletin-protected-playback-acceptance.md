# Verify protected Bulletin listening and account interruption

Use the existing registered `Dotify-Bulletin-pilot-8s` release by **Thot Nzeng**.
[0.1.72 evidence](../backlog/implementation/evidence/product-0.1.72-rollout-2026-11-04.md)
already records successful owner listening on Web, Desktop and mobile. The
[account-lifetime correction](../backlog/implementation/evidence/bulletin-protected-account-lifetime-2026-11-05.md)
is now [published in Web and Product 0.1.73](../backlog/implementation/evidence/product-0.1.73-rollout-2026-11-05.md).
Verify About Dotify shows 0.1.73 (reopen the Host tab, or refresh Web) before
recording its new interruption behavior. The owner confirms the requested Web
artist disconnect/reconnect procedure: "arrêt OK / reprise OK". This is reported
audible stop and explicit recovery, without independent build/sound capture.
Desktop/mobile interruption, account switching and signed unentitled denial
remain open; do not repeat the accepted Web sequence without a new reason.

Do not create another release or buy access to perform a denied-access check.
Keep receipts, custody queues and nonce state. No operator signer, new quota,
service restart, cache wipe or key export is required. Ordinary session identity
confirmation may ask for a signature; stop if a payment approval appears.

## Prepare the comparison

Record Web build/deployment source or Product version, browser/Polkadot app
version, device/OS and network. Use the existing artist account for allowed
listening. For denial use an existing different account known to have no access
(or a disconnected visitor for the guest gate). A guest gate alone does not
prove the signed key service rejects an unentitled account. If no second account
is available, leave that acceptance row unverified rather than buying access or
using a hidden signer.

## Check denial

1. With the unentitled account or visitor, open the existing track. Expect Locked,
   no protected source/sound, and a clear access action; never approve payment.
2. Record which role was tested and the visible result/error. On a controlled
   test build, also check that no full key is requested before access passes.
3. The deterministic key-refusal fixture separately tests a service rejection
   after a positive client read. A physical locked gate is not evidence of that
   second boundary; preserve the distinction in the report.

## Check interruption and explicit recovery

1. With the artist account, start the eight-second release. Disconnect the
   account before it finishes. Expect sound to stop, no playable protected source,
   and Reconnect to listen. For a room host, verify the old output is silent at
   the guest too while the room remains usable. Guests need no content key.
2. Reconnect the same account. Expect an explicit Try again action. Confirm there
   is no automatic playback or payment, then retry; normal authorization should
   reopen the same release without republishing or paying again.
3. If the Host supports switching existing accounts, switch to the unentitled
   account during listening. Expect the old source to stop and an access recheck;
   the new account must not inherit the previous entitlement.
4. Record any sound continuing after disconnect, late restart, error, lost room
   or payment prompt. Do not infer success from catalog/readiness alone.

## What to record

For each Web/Desktop/mobile row, save the client identity, account role (artist,
unentitled or visitor), steps, audible outcome and visible recovery state. Use
public errors/request counts when available; never copy a key, token, mnemonic,
signed session proof or wallet secret into the report. Note whether a real
signed key refusal, a guest gate or a simulated refusal was tested.

Network switching, browser backgrounding and phone audio interruptions are
separate checks. This short release may be fully buffered before switching;
continued sound does not prove uncached recovery. Conservation is also separate:
monitor every app/media dependency and authorization expiry. Reserved quota does
not renew data, and a same-volume copy does not prove disk-loss restoration.
