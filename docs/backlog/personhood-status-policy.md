# Consistent supported personhood evidence (A06)

Issue: [#495](https://github.com/knzeng-e/dotify/issues/495).

Priority: P3. Track: Production spine. Phase: Now. Type: Work.
Base: `dev` `9767cbb657e2ce0ff51bd7f4c216fbd1b360f087` after merged #494.

## Problem and outcome

The declared Individuality reader accepts higher uint8 tiers as stronger than
DIM2, while the typed enum getter reverts on those same values. A malformed
uint8 word can also make abi.decode revert. This is a reproduced future-runtime
compatibility problem, not evidence of a live permissionless bypass.

Apply the fail-closed rule consistently: only the declared None/Lite/Full
statuses (0/1/2) with the supported fixed response shape are usable evidence.
Unknown uint8 tiers remain visible as unsupported diagnostic status, with no
usable alias or access; malformed/unavailable evidence returns no live status.
The typed getter must never panic from an unknown returned enum value.
See the [authoritative reader policy](../reference/personhood-status-policy.md).

## Required implementation and acceptance

- Validate response shape and full status word before narrowing or decoding;
  deny failed, short, long and dirty-word responses without a decoder revert.
- Keep raw diagnostic status, typed getter and both personhood/access predicates
  consistent. Test all uint8 statuses, malformed full words and response lengths.
- Verify HumanFree listening/recording denies unusable evidence while Free,
  verified Classic access, artist identity and context separation stay unchanged.
- Preserve public selectors, storage, context and precompile address; generate
  ABI bindings and document diagnostics with commit-bound local evidence.

## Boundaries

This bounded audit correction does not activate W17, introduce new tiers,
collect identities, add an oracle or establish live proof/Host availability.
No deployment, signature, migration or reset occurs. Target runtime/interface
verification and matched fresh-generation native/device acceptance remain
separate, along with A05/A08 and other remaining audit work.
