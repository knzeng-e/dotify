# Artist-controlled runtime features and upgrade inventory

Issue: [#275](https://github.com/knzeng-e/dotify/issues/275).

Priority: P1. Track: Production spine. Phase: Next. Type: Epic.
Scheduling: after W19's first reviewed Nearby implementation slice. This is a
follow-up to the 2026-10-14 audit, not a dependency of Nearby.

## Outcome and foundation

Artists understand installed capabilities, choose optional compatible modules
at creation and approve updates. Operators inventory runtimes and announce
available versions without acquiring artist upgrade authority.

Read the factory's fixed/resumable bootstrap, the directory's immutable factory
binding, owner-only `DiamondCutPallet`, shared storage/`delegatecall` in
`LibDiamond`, runtime ports and #269's metadata-edit activation requirement.
The existing contracts are a foundation, not a configurable feature catalog.

## Delivery slices

1. Read-only inventory: actual owner, loupe/code, installed versions and update
   compatibility. Explain editing and optional tip-sharing capabilities. Give
   campaign creation/management a distinct workspace module.
2. Reviewed module catalog: chain/code hash, selectors, storage compatibility,
   dependencies, initializer behavior, simulation, owner consent, finalized
   read-back and retry/reconciliation. Facets share privileges; they are not
   sandboxed plugins.
3. Composable creation: common core plus optional choices. Resolve new factory
   and immutable directory migration/aggregation while preserving existing
   runtime discovery and resumable creation.
4. Admin inventory/notices: runtime address, original/current owner, network,
   module versions and update paths. Pull notices suffice initially; external
   notifications need subscriptions and separate authorization to send.

Artist admission has a separate design: distinguish account control, personhood,
artist representation and work rights. Evaluate portable attestations/multiple
issuers without imposing a new DID wallet or one platform's artist profile.
Enforce any chosen admission rule at its authoritative boundary; hiding a
button is insufficient. Create bounded implementation children after design.

## Invariants and acceptance

- Current owner approves updates; Dotify inventory has no upgrade authority.
  Show proposed changes before any signer prompt.
- Verify code, selectors, storage and dependencies before installation.
- Activation, pause and removal preserve purchases, outstanding revenues,
  claim liabilities and campaign promises, or block unsafe changes explicitly.
- Tip sharing affects future contributions, never finalized allocations.
  Unconnected-host behavior follows existing artist policy/rights splits.
- Duplicate/interrupted updates and creation reconcile safely. Finalized state
  defines success; an approval prompt alone does not.
- EVM and Product enforce the same owner rules; claim Host support only after
  physical evidence on that Host.

Planning/inventory does not authorize deploying a factory, cutting live runtimes,
resetting artist data or spending funds. Keep this epic open until its chosen
slices and admission decision are accepted, rather than closing for inventory UI.
