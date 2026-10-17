# Product 0.1.53 room-discovery rollout — 2026-10-17

## Artifact identities

The owner authorized deployment after #300 merged on `dev`. Ordinary Web serves
that merge, `726310b2fe0aee901da64fefb7df9ad56e3efaf8`. Product was published from
the exact green release candidate `83512f708c34304338e6a70c599d38027a9bf68c`
with executable `[0, 1, 53]`. It retains the existing `product-cdm` / `devnet`
profile, contracts, permissions and frozen 13-track catalog.

- Product root and executable CID:
  `bafybeihj6vrdu3dqnaqfofw4l3qiysc4by4rau3mldmlom637waemgmqr4`.
- Ordinary Web entry: `https://muzinga.netlify.app/assets/index-CsyfS8aj.js`,
  SHA-256 `2806084454ea953404ac9f3c07349d243d1dd349ae2147d11664c68f96e2b44b`,
  observed with the full merged application SHA. The existing embedded clean
  flag remains false, so this proves served identity/configuration rather than
  a clean Netlify checkout.
- Signaling release **34**, machine `d8d5205f929e28` in `ams`, image label
  `release-0.1.53-726310b`, manifest digest
  `sha256:1c43ec9ad8a1c1ca3962364c969e5ce75f7a9e47aa917f51b8c19e198cc64fd0`
  and image-config digest
  `sha256:5d9277e965c9d43d5edcbbaecf1842f33a684444dddf5aa4f60a687594dad203`.
- No API, contract, secret, storage, origin or permission change was required.

## Deployment order and boundaries

Privacy-safe signaling v4 was deployed before Product and kept at one worker.
Fresh health checks reported zero rooms, listeners and solo listeners before and
after synthetic validation. V2/v3 discovery remains compatible while v4 supplies
exact connected presence and bounded canonical artwork. The API remained on its
existing release and stable server-only session epoch.

The DotNS mnemonic stayed local and was passed only in the publication process'
environment. A first invocation stopped before build/upload because its isolated
shell could not find `npm`; its `EXIT` trap removed the signer and no transaction
or upload was attempted. The corrected invocation used the pinned Node path and
CLI 0.20.0. The same trap removed the signer after success; an independent
`launchctl` check confirmed removal.

## Publication and independent read-back

Incremental Bulletin publication reused 14 stable chunks, uploaded seven changed
stable chunks plus the manifest/root frames, verified all 24 chunks and waited
for GRANDPA finality before touching DotNS.

- Bulletin stable section: block `1249174`, transaction
  `0x55a8d43d7d3e90e28c7106ab8ccd7ddde190ba888a43572cfd743c5fed492178`.
- Bulletin root: block `1249177`, transaction
  `0x010fd14a0cc1be14f1c0e809ea9f0256fd258c92098257e9a96ca8de6c4066bb`.
- Root content update: Asset Hub block `14559530`, transaction
  `0xc67997a4f386613797156a47df1393f123fcdded774e1e8de231efe1ef343ba5`.
- Atomic app content/executable update:
  `0x335db2c119671fa19e9f494719bd1a5090841a2a14791fb042b23eb2abf2e9c2`.

At finalized Asset Hub block **14559706**, a separate resolver read confirmed
identical root/app contenthash bytes, decoded to the expected CID, and executable
text `{"$v":1,"kind":"app","appVersion":[0,1,53]}`. The public DevNet gateway
returned HTTP 200 and a **13,941,231-byte CAR** with SHA-256
`859d927673e661ad46b07e49068df3d4cd36f7a78eb88cc8d7edbff837e843c0`.
It contains the full candidate source SHA and entry `assets/index-B2wAfwbY.js`.
This verifies publication identity and public retrieval, not an installed Host's
cache or native capabilities.

## Validation

[Exact-candidate CI](https://github.com/knzeng-e/dotify/actions/runs/39035283500)
passed all Web, frozen Product, API, signaling, contracts, repository and
Playwright jobs. Local validation passed formatting, 20 Product deployment guards,
the frozen Product build, six live DevNet endpoint checks, live Host Remote Config
alignment and all 114 signaling tests. The signaling suite needed an unsandboxed
retry solely because the first local runner could not bind a loopback port.

Deployed synthetic checks proved private-by-default room creation, anonymous
code-based joining, allowed/denied origins, v3 wire compatibility, v4 exact
listener counts, canonical privacy filtering, worldwide exclusion for Nearby-only
rooms and immediate acknowledged opt-out. Synthetic rooms were explicitly closed;
no real coordinate, funded tip, user room or protected-media reference was used.

## Remaining acceptance and rollback

Reload installed Desktop 0.1.3 and mobile 0.10.0 and confirm **0.1.53** before
physical acceptance. Test native location prompt/revocation and recovery, Nearby /
Worldwide / Link only persistence, cover planets, exact connected presence,
own-room identity, artist aggregates across private/public rooms, chat, tips and
prolonged multi-track audio. Native Product location remains a Host capability
gate; automated browser fixtures cannot prove it.

Client rollback is Product **0.1.52**, CID
`bafybeicn6kz5i5yyuoalubbe3hsl7sr7qbunccysju5rki3wrtgi2dbz7m`. Keep
privacy-safe signaling v4 on client rollback: restoring an older globally
enumerating server would violate Link only and radius-limited visibility. The
previous signaling image remains available for investigation, but rollback must
not disclose private rooms.
