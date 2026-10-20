# Check a pending payment

A wallet approval, a submitted transaction, finality and a verified Dotify
receipt are different steps. A slow or unavailable read does not prove that
money was sent, received or lost. Keep the original reference and check that
attempt before starting another.

## Gifts and tips

1. Reopen the same gift or track-tip action with the account used for the
   original attempt. If sign-in interrupted the form, its draft resumes with
   the connected identity and a fresh quote before approval.
2. Use **Check status again** when offered. This reads the existing attempt;
   it does not request a new payment signature or resubmit it.
3. Open **Technical details** for the contribution reference, transaction link
   and the uncertainty reported by the previous check.
4. If a native Product transaction has a hash but no usable block reference,
   follow **View transaction**. Enter the explorer's block number in
   **Check receipt block** when offered. This is only a location hint: Dotify
   still verifies the finalized transaction and matching receipt.

After submission, the application runs bounded status checks, pauses them while
the page is hidden, and stops after six retries to limit shared RPC load. Closing
the sheet does not cancel a transaction. Reopening it or using the status action
can resume checks; after a reload, use the same account and contribution action.

**Checking payment status** can mean there is no usable transaction reference.
**Checking contribution receipt** can mean finality is known but the matching
contract event has not been verified. Neither label means failure. A successful
contribution requires a matching finalized receipt, not elapsed time alone.

Product native contributions verify the transaction's contract events from its
canonical finalized block. An Ethereum log lookup alone does not establish a
native `Revive.call` payment. Gifts and tips are voluntary contributions; they
do not buy listening access.

## Classic listening access

Reopen the original release with the original payer account. Follow the offered
access/status check. A confirmed transaction does not by itself open the audio:
the current runtime must confirm paid access and permission to play that release.
Inactive releases or changed access rules can still prevent playback.

Classic payment references are scoped to the network/adapter, account, artist
runtime and track. The browser records an intent before requesting approval.
An uncertain attempt remains recoverable without asking for another payment;
see [access policy](../explanation/access-control-model.md) and
[royalty settlement](../explanation/royalty-settlement.md).

## Keep the recovery context

- Use the same deployment origin, account and network. Browser storage is
  origin-specific; another app origin, RPC scope or device may not see the journal.
- Preserve the reference before clearing browser data. The journal contains
  recovery metadata, not signing keys, content keys or a granted entitlement.
- Avoid concurrent contribution attempts across tabs when Web Locks are
  unavailable. Storage failures block new payment attempts instead of silently
  discarding recovery information.
- A build or a browser fixture does not validate native signing, fees or actual
  settlement. Operators must retain candidate-bound physical Host evidence.

If reads remain unavailable, keep the pending reference for diagnosis rather
than interpreting a timeout as failure. For operator checks, use the
[deployment runbook](../operations/deployment-configuration.md) and
[native contribution design](../design/native-contributions.md).
