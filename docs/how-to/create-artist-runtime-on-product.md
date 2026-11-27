# Create the first artist runtime on Product DevNet

Use the dedicated **Dotify artist setup** candidate for #317 and #85 after
reviewing the [fresh core and CDM readback](../backlog/implementation/evidence/fresh-core-bytecode-2026-11-23.md).
Build from the reviewed clean commit with Node 22 and the locked dependencies.

```sh
npm --prefix web run build:artist-qualification
```

The output lives in `web/dist-artist-qualification/`. Its manifest identifies
the exact source, Product `dotify-test01.dot`, version `0.1.91`, SDK versions and
file hashes. The distinct Product deployment config is
`web/polkadot-app-artist-qualification.config.ts`. Use the
[Product delivery procedure](../operations/product-devnet-deployment.md) to
review the artifact and its publication costs before delivery.

## Create or resume the artist space

1. Open the identified build inside the Polkadot app. Check Runtime 0.31.x
   and grant normal account-sharing consent. The build compares the selected
   key with the fingerprint from the accepted account report, then checks the
   Host signer against that same key.
2. Review the finalized artist state on Paseo. The build simulates the next
   call and displays the peak storage deposit required to execute
   it. Review the network fee separately on the wallet screen. Open the
   wallet only if the operation and cost are acceptable.
3. After finality, check Paseo again to review the next step. Creation has one
   approval followed by seven installation approvals. A submission can only
   continue from the reviewed stage. The build keeps the last attempted stage
   locally and asks you to check wallet activity before retrying an unresolved
   approval. Never approve again while the previous request is pending.
4. Retain the finalized hashes. When setup completes, retain the directory
   and owner readback for the resulting runtime. Use the
   [fresh-generation procedure](prepare-fresh-testnet-generation.md) for
   subsequent service/client activation.

The candidate exposes artist setup only. Device acceptance requires the actual
Product Host, its account and its wallet screens. Fixture and build checks
cannot establish actual account control, on-chain completion or fees.
