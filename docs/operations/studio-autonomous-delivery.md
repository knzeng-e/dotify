# Prepare the autonomous Studio delivery

This candidate follows merged #513, #514 and #515 from dev `5d775035`.
It prepares Product 0.1.92 and matching Web, API, custody and signaling
configuration for the artist-created runtime. Hosted activation is pending.

## Generation bindings

| Component | Candidate |
| --- | --- |
| Chain | Paseo Asset Hub, 420420417, 10 native decimals |
| Factory | `0xe2199c16ea32402dd2bdc3730afba49ad5cd83f5` |
| Directory | `0x8af1531278831fe92689558f7b6cae92fc682ca4` |
| Artist runtime | `0xc87da778ac7aeedf0c13e13e26d9c5248f0cf22a` |
| Shared namespace | `dotify-dev-20261127` |
| Custody publisher root | `/data/contributions/bulletin-development-20261127` |
| Contribution receipts | `/data/contributions/fresh-20261127/receipts.json` |
| Product | `dotify-test01.dot`, 0.1.92 |

The Fly profiles in this branch target these bindings. Deploy them together
after provisioning. Use the [managed namespace reset](shared-api-state.md#reset-a-managed-development-namespace)
for PostgreSQL and the [fresh publisher initializer](bulletin-fresh-development.md)
for the new content-key domain. Verify every retired key version before
selecting a new one. Install the new key mapping on custody and both key-serving
edges through private secret input.

## Read-only checkpoint on 27 November 2026

The public API pair still names the earlier factory/directory and namespace
`dotify`. Custody is stopped with its earlier profile. Encoder and signaling
are running. These observations describe the existing deployment.

At finalized Bulletin block 1,832,987, the publishing account
`5DnPdzxJWgfFuh1VYzpvz2TzU8BhPzfGKSzsDhGEkhvXEdca`
has nonce 2179 and no storage authorization. Obtain a grant through the
[Bulletin authorization procedure](https://docs.polkadot.com/reference/apps/infrastructure/bulletin-chain/authorization/),
then reread its finalized counters and expiry. Confirm its network matches
the publisher profile.

Size the grant against the proposed release count, per-part graph caps,
retry allowance, existing renewal obligations and the actual client artifact.
The earlier local obligation floor is 2,397 transactions and 613,172,038 bytes.
Refresh it before selecting the final envelope. A first artist track or cover
is unnecessary for preparing the reusable allowance.

## Activation order

1. Verify CI for the reviewed release commit. Prepare the private key-bound
   publisher, independent session credentials and empty receipt path. Record
   the profile digest and the finalized account nonce and grant.
2. Review the resulting service maintenance and application publication budget,
   including the exact Product artifact and DotNS calls.
3. Quiesce old API writers. Take the provider snapshot and execute the atomic
   managed namespace cutover. Verify namespace visibility with the runtime role.
4. Install the new key/profile settings and start exactly one custody writer,
   then matching edges and signaling. Remove the old standalone public-asset
   policy setting. Verify readiness, private forwarding and current directory.
5. Generate the Product bootstrap catalogue from the newly running API.
   Confirm the new runtime is listed and the old releases are absent. Build the
   full Studio Product executable and matching Web from the reviewed source.
6. Publish and read back the complete client bytes and DotNS records. Check
   ordinary upload, refill feedback and same-draft retry, artist wallet approval,
   catalogue visibility, listening and a shared Room on the named devices.

The checked-in bootstrap has its own historical source. Refreshing it from the
new service is required before the final executable is packaged. A successful
frozen build alone establishes compilation.
