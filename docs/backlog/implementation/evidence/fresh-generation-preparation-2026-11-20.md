# Fresh generation preparation — 20 November 2026

## Source and result

Source `6a1076d9aa50d7402f2fd99f36277271161fee55` starts from merged SDK #483 /
`dev` `e109968a3813eb5d266416c84f45e60275369330`. That baseline has the same
tree as tested `b284260b` and its [merged quality run](https://github.com/knzeng-e/dotify/actions/runs/44751172474)
also passes. #317 now owns the selected fresh-generation preparation, with
#484 and #85 retaining native-payment and named-Host acceptance.

The preparation fixes an omitted default capability: new factories now deploy
and install `MusicMetadataPallet`. Seven install/finalize calls follow creation;
metadata is installed before the artist-signed ownership/readiness/directory
transition. Existing correction and artist/administrator tests now use that
default setup rather than adding metadata manually. Contributions remain in
the royalty implementation; no NFT or separate contribution facet is added.

`deploy.ts` and the local regression share `deploySystem.ts`; the shared inventory
drives creation/verification and plan counts. Directory wiring is confirmed
before the helper returns a deployment manifest. Read-only planning takes an
explicit public H160 and never constructs a signing client. Exact CDM versions
replace the former search through versions 0–7. Readback verifies all ten code
bodies, compiler-declared immutable slots plus their getter values, directory
bindings/deployer, native precision and an empty directory at one explicit block.

## Local validation

Environment: macOS arm64, Node 22.13.1. Web/API checks reused matching lockfile
dependency trees; contracts also pass after a clean offline install. Checks ran
on this source worktree before the commit. No application/tooling change follows
them in the subsequent evidence-only commit.

| Check | Result |
| --- | --- |
| Contracts `npm test` | **133 pass**; real operator deployment path, default metadata, pending-to-ready boundary, bad manifest/code/precision, exact CDM versions and existing payment/access regressions |
| Web `npm run test:unit` | **1,280 pass / 164 files**, including creation/resumption through eight approvals |
| API `npm test` | **698 pass** |
| API `npm run typecheck` | Pass |
| Web `npm run test:product-deploy-environment` | **121 pass**; no live Host acceptance inferred |
| Contract/Web formatting and Web lint | Pass; the two existing App hook warnings remain |
| Web and frozen Product builds | Pass; existing large-chunk warnings remain |
| ABI/CDM/metadata generation | Pass; factory metadata is a locally computed candidate, not a published registry change |
| Backlog, added local documentation links/anchors and whitespace | Pass |

The optional full contracts `tsc --noEmit` check is **not green**: 181 diagnostics
remain, compared with 188 on the identical tested baseline tree. Comparing
diagnostics by path/message introduces none; address validation removes seven
old `smartRuntime.ts` diagnostics. This repository-wide type debt is not a
claimed pass or silently repaired as part of deployment preparation.

The builds are local validation outputs made before the source freeze, not
published clients carrying a new release identity. Local EVM success is not
Revive resource or physical Host acceptance. The [procedure](../../../how-to/prepare-fresh-testnet-generation.md)
owns the remaining operational steps.

## Actual public plan, without signing

After the clean source commit, `fresh:plan:testnet` runs with explicit public
deployer `0xC3571714248588C6E19cDECe2778B75341b2c288` and candidate native precision
`10`. The [raw public v2 plan](fresh-generation-plan-2026-11-20.json) binds that
clean commit, the ten creation-code hashes and the public chain observation:

- Chain 420420417, finalized block **15,997,893**, hash
  `0xcd1b47a69ea185a37700373701c7718cf5d6ff6bd0476e5ca446a57c81389166`.
- Pending nonce **485**, an observation rather than a reservation/reset.
- **11 core transactions planned**: ten creations and one directory wiring.
  CDM, Bulletin storage/retention, client publication, artist setup and funded
  acceptance are excluded from that count and have no spend authorization here.
- `signingAuthority: none`; no old contract or storage object is modified/deleted.

Native precision is an explicit plan input, not newly proven by this balance
read or by EVM currency metadata. New addresses, finalized new-code/CDM readback,
source verification, costs/receipts and coherent service/client delivery still
have to be established during the separately reviewed operation. No new core,
artist, release, secret domain, receipt queue, Product or state cutover is deployed
by this source preparation. CASH remains disabled.
