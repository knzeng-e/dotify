# Runtime artist identity and technical administration

This reference defines the A03 source candidate, following the owner's
19 November 2026 decision: an ownership transfer delegates technical
administration; it does not transfer artist identity. [Scope #490](../backlog/runtime-artist-authority.md).
The candidate belongs to the selected fresh testnet generation, not an upgrade
or migration of previously deployed artists/releases/references.

## Roles

| Role | Authority in the reviewed facets | What administration transfer does |
| --- | --- | --- |
| Bound artist, `runtimeArtist()` | Registration, uploads, profile gift policy and remainder | Stays with the original artist |
| Recorded track artist | Metadata, deactivation/reactivation, access policy and work gift policy | Does not rewrite historic authorship or controls |
| Technical administrator, `owner()` | Diamond upgrades and administration offers | Moves only after recipient acceptance |
| NFT holder | Existing NFT ownership and its access policy | Does not move or acquire artist policy rights |
| Royalty/gift/claim recipient | Existing split, quote and claim rules | Does not redirect or erase these balances |
| Pending administrator, `pendingOwner()` | Acceptance of the current offer only | Has no current upgrade or artist authority |

An administrator can still install arbitrary delegated code. This separation
holds for the reviewed facets; it does not constrain a malicious/compromised
upgrade controller or guarantee owner-proof royalties. The existing legacy
personhood-registrar setter remains an administrative compatibility surface;
current HumanFree authorization uses the Individuality precompile instead.
Artist-wallet succession and recovery need a distinct design; this API does
not silently rotate identity or rewrite previous works.

## Creation and storage

`SmartRuntime(owner, artist, initialCuts, init, initCalldata)` now binds a nonzero
artist independently of the initial administrator. `LibRuntimeArtist` owns the
namespaced `keccak256("dotify.runtime.artist.storage")` slot, containing artist
and publication readiness. No normal facet changes the artist after creation.
`LibDiamond.DiamondStorage` appends a pending-owner field; existing routing,
interface and owner fields retain their order. The namespaced registry, NFT,
access, royalties and contribution storage layouts are unchanged.

For factory creation the initial administrator is the factory and the bound
artist is its caller. During staged installation, artist publication and profile
gifts stay blocked. The artist's final signed `installRuntimeStep` invokes the
one-time identity-checked finalizer, marks readiness, assigns initial
administration to that artist and registers the directory entry atomically.
There is no extra acceptance transaction during artist-requested creation.
Re-running that finalizer after completion reverts. Direct artist-owned
construction completes readiness before constructor return, for local fixtures
and explicit deployments; a factory-owned staged shell does not.

This preserves the existing seven-step factory installation journey. The
factory installs all six ownership selectors, including the artist view and
the pending/accept/cancel functions. The constructor ABI and creation bytecode
change: deploy a matched fresh factory/runtime/initializer generation.

## Subsequent administration transfer

| Function | Result |
| --- | --- |
| `owner()` | Current technical administrator |
| `runtimeArtist()` | Stable artist identity |
| `pendingOwner()` | Offered successor, or zero |
| `transferOwnership(newOwner)` | Current administrator offers/replaces a successor; owner is unchanged |
| `acceptOwnership()` | Only that pending account becomes administrator; offer clears |
| `cancelOwnershipTransfer()` | Current administrator clears an offer |

Zero, self-runtime and current-owner destinations are rejected. Replacement or
cancellation invalidates earlier acceptance rights. There is no automatic
expiry: the current owner retains control and can cancel. Every internal owner
change clears the pending offer, preventing a stale recipient from inheriting
new authority. Contract governance accounts may accept through their own call
execution; tools must not impersonate them. No transfer UI is added here.

Administration does not change directory membership `A -> runtime`, artist
registration rights, profile identity or work authorship. B may administer A
while having no artist runtime, or while keeping B's separate artist runtime.
A continues normal artist operations; B cannot register new works as A merely
by becoming the administrator. After acceptance B can perform real upgrades;
A no longer has that administrative power unless a later offer is accepted.

## API and generated interfaces

The API verifies `runtimeArtist()` rather than equating artist with `owner()`.
Uploads require the directory/runtime artist pair to match the signed session
account in both finalized and current canonical state. A profile not yet
finalized gets a retryable service denial. A mismatched identity gets
`ARTIST_IDENTITY_MISMATCH` before any upload capacity is issued. When B also
has an artist profile, its upload authority is scoped to B's own directory
runtime, not A's administered runtime.

Audio-key checks add the bound artist to A09's existing directory, track and
access checks at both hashes. Distinct states require eight contract reads;
one shared state requires four. The existing block-pair cache identity,
expiry, session, denial and no-repeat-payment behavior remains. Missing or
unsupported identity reads fail closed; there is no legacy owner fallback.

The compiler generates the Web `runtimeOwnershipAbi` and the API's minimal
`runtimeArtistAbi`; run `npm --prefix contracts/evm run generate:abis` and check
for drift. Registry audit tooling compares authorship with runtime artist,
while reporting the separate administrator. A legitimate delegated owner is
not classified as a foreign author; upgrades still require its signature.
Older runtimes lacking this interface are not valid A03 migration targets for
the retained one-selector hotfix tooling.

## Delivery boundary

Source and local EVM/API validation do not deploy these contracts. Follow the
[matched-generation gate](../operations/deployment-configuration.md#artist-authority-candidate-490).
An API requiring this getter must not be delivered ahead of a compatible fresh
contract generation. Validate target Revive compiler/resource behavior, role
readback, finalized/current proofs, artist publishing, gifts and listening
before activation. No old state, key secret, pending claim or nonce is reset
by this source change. A04/A06 and other audit corrections remain separate.
