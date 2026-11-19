# Supported personhood evidence

Use this reference to interpret contract diagnostics and review HumanFree access.
The A06 source candidate supports only Dotify's declared Individuality ABI;
it does not prove that a target chain or Host exposes a usable humanity proof.

## Reader contract

`LibPersonhood.readStatus` calls the fixed precompile address
`0x000000000000000000000000000000000a010000` with the fixed
`bytes32('dotify')` context. It uses a low-level `staticcall`: an absent
precompile can have no bytecode and return empty bytes without reverting.
Call success alone is insufficient evidence.

The supported response is exactly 64 bytes: a canonical ABI `uint8` status
word followed by a `bytes32` context alias. The reader checks the entire first
word before narrowing, so dirty upper bits cannot turn into a valid tier or
trigger an ABI decoder revert. Extra bytes are refused as an unsupported layout.

| Response | Raw `(status, alias, live)` | Typed level | DIM1 / DIM2 gates |
| --- | --- | --- | --- |
| Supported None (0) | `(0, returned alias, true)` | None | deny / deny |
| Supported Lite (1) | `(1, returned alias, true)` | DIM1 | allow / deny |
| Supported Full (2) | `(2, returned alias, true)` | DIM2 | allow / allow |
| Unsupported uint8 (3..255) | `(returned status, zero, false)` | None | deny / deny |
| Failed call, wrong length or status word >255 | `(0, zero, false)` | None | deny / deny |

`live` means supported, usable evidence, rather than merely a responding
precompile. Supported None is distinguishable from unusable evidence. Unknown
uint8 tiers remain diagnostic; their aliases cannot be used as verified identity.
The typed getter maps supported tiers explicitly, with no unchecked enum cast.
Any future tier or response layout requires explicit protocol review.

A required level of None still means no requirement. Registered HumanFree
tracks require DIM1 or DIM2; unusable evidence denies both playback access and
`musicRoyRecordListen`. Free access, verified Classic entitlements and the
original artist's access are independent of this reader. The deprecated manual
personhood setter remains disabled. This policy adds no identity collection,
oracle or manual override.

## Compatibility and acceptance

Public selectors, argument/return ABI, storage, precompile address and context
are unchanged. Access and royalties bytecode changes because they include the
reader library. API/Web generated ABIs must remain identical; callers must not
interpret a nonzero raw diagnostic tier as access authority. The API continues
to use the on-chain access decision.

This candidate belongs to the owner-selected matched fresh testnet generation
after the other audit corrections. It does not deploy code, migrate old state
or activate [W17 research](../backlog/implementation/W17-human-free-evidence.md).
Target runtime/interface verification, real proof availability and physical
Host acceptance remain separate [deployment checks](../operations/deployment-configuration.md#personhood-reader-a06).
Local injected precompile responses establish parser/policy behavior only.

Implementation: `contracts/evm/contracts/libraries/LibPersonhood.sol`,
`contracts/evm/contracts/pallets/MusicAccessPallet.sol` and
`contracts/evm/test/PersonhoodPolicy.test.ts`. The [scope](../backlog/personhood-status-policy.md)
tracks the bounded audit correction separately from live integration.
