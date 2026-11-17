# Generated second-Mac recovery — 2026-11-13

The owner reports **reconstruction OK / authentication OK** on the selected
second Apple Silicon Mac after receiving a generated-only portable-v2 package.
This is declared device acceptance; destination reports were not inspected
remotely. The packet contains public structural data/fixture keys, not an artist
release or real content master. The empty separate key vault remains empty.

## Artifact and local evidence

Reader source: #444 `8b28c5cee3ba5aeedc537a439f2cf95225511dfb`, with the same
API tree as tested dev `c6e6fea8f237ba754bf388f0ba1022f064dc895b`. A generated
harness is added; the packet uses the earlier **Node 22.13.1** runtime, not the
subsequent Node security-refresh candidate.

- ZIP: 144,052,579 bytes; SHA-256
  `bb99ba0aebf90769f8295fd54bf4bf97220950fa91f6f46ac604aaa1b0b51df2`.
- Reader configuration ID:
  `sha256:6d2e9444b7cba3119ce8da8850d900646883743889fb3d2670dd010da2866725`.
- Reader OCI-manifest ID:
  `sha256:0456421c03f0ac4a422960c52a00f2c598a7df37e106246ad2a8d9b8f44df66e`.
- Local export retains its name; all thirteen image blobs match recorded
  digests/sizes. From a cold import of the extracted ZIP, both layouts reconstruct
  and authenticate fourteen objects each. The second phase uses read-only output
  without the input checkpoint mounted. Temporary labeled volumes/containers
  are removed. A changed packet is refused before Docker runs.

## First packet failure and correction

The first packet passes file checks on the destination but cannot find its
reader by configuration ID; reconstruction never begins. Its export is anonymous
and the launcher accepts only the producer’s configuration ID. The local warm
image masked that missing cold-import coverage.

Portable-v2 retains a name, accepts only the two recorded identities for its
artifact/platform and pins the observed immutable ID. Local full reconstruction
runs on the classic store; both identity conventions and identity/platform
refusals also pass CLI simulation. No separate local containerd-engine execution
is claimed. The owner’s subsequent second-Mac success is the physical acceptance
above. The [runtime reference](../../../reference/server-runtime.md#portable-offline-readers)
owns the reusable packaging rule.

## What remains

This validates generated staging on the other computer. Real encrypted data
transfer, separately recovered content masters, origin/current-history evidence,
retained release coverage and real authentication remain open. Service/image
rollback, hosted capacity, audible Web/Host/locked-screen behavior and acceptable
live publication latency remain distinct #407 gates. Nothing in this rehearsal
authorizes inspection/export of real custody, maintenance, chain writes or
writer activation. A real reader must be separately pinned after the relevant
security reviews; this generated ownership adapter is not its import procedure.
