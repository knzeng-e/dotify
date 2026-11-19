# A07 and NFT removal — local evidence, 19 November 2026

Candidate: `c74bdcd71dd8cd7e6b9dff54cc20a55c2dd809c6`, based on merged `dev`
`ba2b8f92c487daa052ef0b383f5560fab9227d4d` (#492).
[Scope #493](../../native-price-without-nft.md) and
[authoritative price/interface model](../../../reference/native-price-without-nft.md).

Application, API and contract source was frozen at
`03e6871d1597f0ad58d1a1638c4aa0a1dde769ac`. The later candidate changes only
two signaling test fixtures to use the direct track-record result; the source
and generated artifacts are identical. The checks below therefore bind to that
application source plus the final signaling fixtures, rather than a deployed
address or device build.

## Environment and observations

An isolated macOS arm64 worktree used Node 22.23.5 and dependencies matching
the tracked lockfiles. Solidity compilation used 0.8.28, Hardhat 2.27, the
Paris EVM target and via IR. Test wallets, HTTP/Socket.IO servers and RPC
models were local. No public transaction was sent.

| Check | Result | Relevant proof |
| --- | --- | --- |
| Contracts `npm test` | 105 passed | Native precisions 0/10/12/18, minimum units and uint128 bounds, atomic refusal of inexact registration/edits, exact local payout and access, absent NFT selectors/interface/mint events, existing royalty/administration regressions |
| API `npm test` | 694 passed, 45 suites, none skipped | Direct record ABI, exact tiny-price catalog output, finalized/current key authority, runtime isolation and existing custody/publication/recovery regressions |
| API typecheck/build | Passed | Compiler-generated registry ABI and removed catalog token fields agree with service types |
| Web `test:unit` | 1,254 passed, 163 files | Both writer preflights, precision mismatch/dust refusal before signing, exact input/fallback amounts, studio refusal before asset preparation and existing player/UI regressions |
| Web `test:signal` | 131 passed, 11 suites, none skipped | Direct record readers for contributions, artist activity and visits, room privacy/authorization and signaling regressions |
| Bulletin `test:protected` | 9 passed, none skipped | Offline encrypted publication/retry, signed access and selective real AAC decryption with the new record shape; denied identities derive no additional key |
| Web and Product DevNet builds | Passed | Both target bundles compile with the NFT-free interfaces and exact-price readers |
| Contract/Web format checks and Web lint | Passed | No lint errors; two existing `App.tsx` effect-dependency warnings remain |
| ABI, CDM binding and candidate metadata regeneration | No drift | Seven Web ABI modules, API registry binding, Product merged ABI/types and metadata agree with compiler artifacts |
| Backlog, whitespace and introduced documentation links/anchors | Passed | Scope/index and coordinated-delivery navigation resolve |

Web and Product retain the existing bundle-size warning. Product build used the
checked-in catalog fixture/bootstrap with an unavailable loopback API endpoint,
without reading a live catalog. Candidate metadata CIDs were calculated locally;
no CDM package or Bulletin metadata was published.

The initial full signaling run exposed two remaining fixture wrappers from the
old two-result registry API. Those were corrected without weakening assertions:
the final 16 targeted artist/activity/visit tests and all 131 signaling tests
pass. The earlier failed run is not acceptance evidence.

## Limits and delivery gates

These are source and local EVM observations. They do not establish target
Revive compiler/resource limits, physical Host support, real native-recipient
settlement or a completed fresh rollout. Verify the configured native decimals
against the target chain and adapter, finalized role/precision/selector readback,
minimum-price native publication/payment and audible listening before activation.
See the [matched-generation gate](../../../operations/deployment-configuration.md#native-price-and-nft-removal-493).

The getter/event/storage and catalog shape change requires matched fresh
contracts, API/catalog and clients. Earlier deployment addresses and the
finalized CDM snapshot remain historical inputs; the candidate ABI is not their
deployed interface. No old NFT/state import, catalog reset, key/nonce/receipt
deletion, signature or live payment occurred. Arbitrary upgrade administration
remains a trust boundary. A05 policy, A06/A08, remaining audit corrections and
native/device delivery acceptance remain separate.
