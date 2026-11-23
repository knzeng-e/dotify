# Fresh Paseo core bytecode, 23 November 2026

The [public readback](fresh-core-bytecode-2026-11-23.json) checks source
`ee4df712d49c17ac2172db63e7f2836d6018c122` at finalized Paseo EVM block
**16,129,661**. The ten deployed bytecodes match compiler output
with the constructor immutables filled from the reviewed deployment manifest
and the explicit public deployer address. The factory/directory and facet
getters agree, the native precision is 10, the directory contains zero
finalized artists, and both exact CDM version-4 bindings resolve to the new core.

Hardhat compiled 32 Solidity inputs with 0.8.28, optimizer 200, viaIR and Paris in
an isolated checkout. Each compiler input matched its source file. The read
used a public RPC and a Hardhat configuration with no accounts. All 133 local
contract tests passed.

This trusted RPC observation establishes the bytecode and bindings at that
block. Global native pending-runtime discovery and signer control still precede
the publication attestation and artist approvals. No runtime was created and
the publication quarantine remains in effect.
