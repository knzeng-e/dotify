# Product 0.1.57 and GitHub 1.4.0 rollout, 2026-10-20

The owner authorized publication after promotion #314 merged. GitHub
[1.4.0](https://github.com/knzeng-e/dotify/releases/tag/1.4.0) is published as a
testnet prerelease, not the accepted public pilot. Refs #158 and W13.
This document records deployed identities; its later commit is not the signed
Product source. Draft #312/W32 is excluded from the release.

## Source and deployed identities

| Surface | Verified identity |
| --- | --- |
| GitHub 1.4.0 tag | `9788ec0b097dcf3144082ad180c0d0e59ee81650` |
| Tested dev / served Web | `615ad44c798228e2cd1f87d2928c891ca29ef9bf` |
| Main and dev full Git tree | `28c9417bf87bad5d3f35525cc9c6c0e2594d0b4b` |
| Application source tree (`web/src`) | `e6a759e14b2d50f47e2159402438c8e2cfd165c3` |
| Product packaging source | `a789d8ecb63287013a46a4e268827184c2e67ca4` |
| Product executable/profile | `[0,1,57]`, `product-cdm` / `devnet`, frozen 13 releases |
| Root/app transport CID | `bafybeifba24wrvu2ywkurapvsjmeub3llviu2tybc3hkzljobww3ordqqm` |
| Product entry | `assets/index-BTi0Y1Lu.js` |
| Entry SHA-256 | `57b629095431313e2c6a2b83a656e276051938c8ee474f37f80c43c07d45d16a` |
| Deploy config SHA-256 | `6e11275d9b98c3634c869cc69d35873297f19987448697d1fdb8425e528e2264` |
| Frozen catalog SHA-256 | `caa0e8181bea53c77e4a12e726695dc4d3caad1dd516808e4b704cdf813ded71` |

Packaging started from tested dev. Its sole application/configuration delta is
executable version 0.1.56 to 0.1.57. The complete dev tree equals final main,
so the already-published Web deploy `6ad794bc91a585c41cecef08` needs no redundant
rebuild solely to change its embedded source SHA. Browser checks independently
found `615ad44` in `https://muzinga.netlify.app/assets/index-BoOSkkpJ.js`, SHA-256
`e20dc96efbe68a9a1663dc2b06d219ad8d8c93405c6bc00068ca6345b45b1563`.

API remains Fly release **28**, source
`0d002e373f42c5a4a03100306a58efcc9156da2d`; signaling remains release **36**,
source `74effe95da53394dec9394666f30d4e14bac024c`. Source comparisons found no
API, signaling/shared-server or EVM contract diff requiring deployment. Health
and readiness HTTP 200 passed. No service restart, key rotation, session epoch,
origin, volume, topology or contract migration was performed.

## Publication and independent integrity checks

The wrapper required clean exact packaging SHA plus successful exact-candidate
CI before accessing the owner-enabled local signer. A fresh finalized read
confirmed rollback 0.1.56 before signing. The signer was passed only through the
local child environment, never a command argument, file, frontend or CI value.
Cleanup removed `MNEMONIC` from launchctl and verified absence.

Bulletin stable upload: block **1293444**, transaction
`0x296b20c261c9a6bfc4ffd6eebe132372ec13755a365e37614cad13cd4525edfc`.
Root upload: block **1293447**, transaction
`0x544f77aa2c2d01de5933be9d7ff1bb244f9053a269678e406bc6ab6fb8cdad8c`.
Nine chunks initially awaited finality. After the CLI's bounded natural wait,
one still-missing chunk was automatically uploaded again; **all 24** storage
chunks and the root then passed finality. The operator did not repeat the
publication command or bypass finality.

Root DotNS update finalized at Asset Hub block **14692193**, transaction
`0xd7573bbb296e9717241cde94c55d81a039cbe3b83865439218c8b6c70dd18e05`.
Atomic app content/executable update:
`0xd1edde5af11c270ef63537ca0629b036b449dde35f70d95022ff856ca9f64c62`.
Independent read-back at finalized block **14692233** confirmed both contenthash
values and `{"$v":1,"kind":"app","appVersion":[0,1,57]}`.

The public gateway returned a **13,965,780-byte CAR**, SHA-256
`18554bfd09638078b9bb7c5ff18af5329622de174da3edf6ac6024e608eeeb31`.
All **125 block hashes** pass. Its inner UnixFS root
`bafybeib7za7nz7wzjsdgre73gg4pxxgrmqacm2w7twepo2j32kdhrflrmm` equals a
fresh local merkleization. Public index and entry match signed local bytes,
including the full packaging SHA. The inner directory root intentionally
differs from the transport CID.

Delivery was not uniformly fast: initial Node fetch and connect attempts timed
out; an IPv4 curl read obtained 4,197,260 bytes before its 60-second timeout.
A successful HTTP 206 resume returned exactly
`bytes 4197260-13965779/13965780`, completing the file in about 7.4 seconds.
Hash/root validation covers the complete reconstructed public CAR. This is
integrity evidence, not acceptance of cold-start latency or gateway reliability.

## Web, public documentation and installed Desktop

- Exact packaging [eight-job CI](https://github.com/knzeng-e/dotify/actions/runs/39461071884)
  and [signer-free release validation](https://github.com/knzeng-e/dotify/actions/runs/39461236969)
  passed. Final main runs `39459262617`/`39459262745` and tested-dev run
  `39456525029` also pass. An initial mistyped-SHA validation dispatch
  `39461078871` was canceled before publication; it is not acceptance evidence.
- Clean frozen build, 20 publication guards, six live endpoint checks and fresh
  Host Remote Config alignment pass. CLI 0.20.0, registry
  `0xb052E5EfC5ADEff1f21d48DEfb5169Cb394A1a73` and resolver
  `0x7e75491ecfb04900EB05ee63CABA2B33900aABB5` agree with channel paseo.
  Existing bundle-size, dependency/audit and Browserslist warnings are not fixed.
- Web smoke at 1440 x 1000 and 390 x 844 verified automatic galaxy display,
  a clearly labelled temporary Worldwide room, its profile preview, reversible
  Hide, no page errors/overflow and a 65,536-byte browser ciphertext Range read
  (206). No content key, plaintext, actual user location or payment was read.
  The temporary host was closed; later health reported zero rooms/listeners.
- Mobile form simulation kept room name, invitation and labels above a 370 px
  visual viewport with 30 px offset, retained drafts and dismissed the form
  without submission. This is not a physical software-keyboard test.
- Installed **Polkadot Desktop Dev 0.1.3** loaded
  `polkadot://app.dotify-test01.dot/`, catalog/artwork and room creation fields.
  Room name/invitation editing and dismissal worked without opening a room or
  connecting an account. The owner accepted the Google-font domain prompt;
  the agent changed no Host permissions. The native UI does not establish the
  loaded JavaScript SHA. Native location returned the explicit browser fallback;
  a transient Worldwide refresh error cleared automatically. Native discovery,
  first sound, background audio and funded receipt/chat recovery are not accepted.

GitHub Pages initially returned 404 because it had no source configured. The
release enabled **legacy `main:/docs`**, using the existing `.nojekyll` file.
The optional `ENABLE_GITHUB_PAGES` Actions flag remains unset: the two optional
workflows target different app/docs outputs and must not race. No frontend app
or credential is exposed by this documentation-only configuration.
The Pages build from `9788ec0` passed; public HTML and gallery image return 200.
The three-room screenshot is byte-identical to source (97,620 bytes). HTML
SHA-256 at validation:
`7043c3a79d2f40658287b584c90c794aa0c97c47162b6a919bc4b658ece6a25d`.
The release-version documentation changes in this rollout PR become public only
after their later promotion to main; the existing deployed gallery is verified.

## Rollback and remaining acceptance

First client fallback: **Product 0.1.56**, CID
`bafybeieactmt5ci6iqp62foewyh7frb6gqamvo6d7hdivgy2tiyinfgn2u`.
Its retained CAR matches recorded SHA-256
`83e273e97d2e178462fdc20918a7c48647d598847d761ff33d1bc97cc65c1b61`.
Its finalized root/app identity and executable were checked before publication.
Prior fallback: 0.1.55. Keep API 28/signaling 36, retained content-key versions,
persistent catalog/revocation state and current single-writer/process topology.
This is not a new live rollback rehearsal. Verify Web and Product separately
after any rollback; do not infer the installed Host cache from DotNS alone.

Keep #158 open for measured first sound, room recovery/TURN, physical-device
coverage, paid access/tip receipt/chat and rollback evidence before pilot go/no-go.
No funded payment was submitted or replayed. The previously reported pending tip
remains unresolved without its native receipt block. Historical owner-confirmed
mobile keyboard behavior is not a new full matrix pass. Public CAR integrity,
CI and UI rendering do not prove audibility, location or financial settlement.
