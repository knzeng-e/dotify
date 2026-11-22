# Native factory prerequisites — 23 November 2026

The fresh factory's empty-state prerequisite passes at finalized block
**16,099,062** using committed source
[`770c6e87`](https://github.com/knzeng-e/dotify/commit/770c6e878d4588c5acd4ae8487c137f822d8d5ed).
This is an operator readback, not artist signer control or an active-client
publication attestation. [Machine-readable results](native-factory-prerequisites-2026-11-23.json).

## Observed

The registry audit v2 and fresh core/CDM readback v3 independently selected the
same finalized block. Both pass. The native proof uses the configured Dwellir
Asset Hub endpoint; the EVM endpoint is the reviewed Hardhat testnet setting.

| Check | Result |
| --- | --- |
| Factory / directory | `0xe2199c16ea32402dd2bdc3730afba49ad5cd83f5` / `0x8af1531278831fe92689558f7b6cae92fc682ca4`; pairing verified |
| Implementations | All ten reviewed bytecodes and factory/directory bindings match |
| Precision / CDM | Native 10 decimals; both package address/version pairs match exact version 4 |
| Directory / unfinished shells | Zero finalized artists; native factory storage has zero items and zero bytes |
| Factory code hash | `0x4e5146050a4b80b238107dc3f559123b45c8547df5a99d63af3fbf7f561dfaad` on both surfaces |
| Native block hash | `0x80f6f6ae83094f8f7365e8d3beac36f7fe8b969aea8ee3b6009f664d33757cf1` |
| EVM block hash | `0x634f3ff1feabb13c3655a3a3fcce0605224de0a5df606dd06705e3632e28b72b`; native `Revive.BlockHash` matches |

The factory code/storage result covers native and EVM callers at that block;
it is not a scan of historical native events. The
[reference](../../../reference/native-factory-readback.md) defines its RPC trust,
nonempty-state refusal and lifetime. Repeat the readback before artist approvals.

## Local validation and limits

The source tree committed as `770c6e87` passes 153 contract tests, including
18 native proof cases and the task-level no-native-evidence refusal. Contract
formatting, compilation, generated ABI drift, backlog consistency, whitespace
and 440 local documentation link targets pass. Full contract `tsc --noEmit`
is not green: 181 existing diagnostics reproduce on base `50f3c003` with the
same installed dependencies; normalized diagnostics add none in this candidate.
This supplementary comparison does not replace the passing contract CI commands.

No signer, public-network transaction, Host account request, runtime creation,
Product publication, service activation or attestation rewrite occurred.
Existing custody remains outside this read-only operation. SDK/Host account
choice and mapping retain their separate accepted evidence. Identified signer
control, artist onboarding, coherent services and actual native settlement/media
acceptance keep #85 / #317 open; CASH remains disabled.
