# Product 0.1.56 mobile-form rollout, 2026-10-19 UTC

The owner authorized test deployment after #307 merged into `dev`
`b08966698709b06378349a6ffd0567cda5dc8f53`. Product executable `[0, 1, 56]`
was published from clean packaging commit
`c9becc990b26949445e9af69da357c08789d4f28`, with `product-cdm` on `devnet`
and the paired frozen 13-release catalog. Later documentation commits record
this publication without changing its signed source identity.
Refs #158, #306, #88 and #89. Local handoff continues on 2026-10-20 in Paris;
publication and independent read-back occurred on 2026-10-19 UTC.

## Published identities

- Product root/app transport CID:
  `bafybeieactmt5ci6iqp62foewyh7frb6gqamvo6d7hdivgy2tiyinfgn2u`.
- Product entry: `assets/index-CPodH1Pc.js`, SHA-256
  `ce2ebc3a3401645234a29abf8fe8abad376acef06a9275eb3b8e2a541e1feaba`.
- Web Netlify deploy `6ad68c0f85f9ee688e1d2765` already served merged dev.
  Independent browser checks at 1440 x 1000 and 390 x 844 found source SHA
  `b08966698709b06378349a6ffd0567cda5dc8f53` in
  `https://muzinga.netlify.app/assets/index-C-ZrOTsC.js`, SHA-256
  `136bc431653b893f42606b733edadd22f6d8037f5ca10f75781c4177526ca225`.
- API remains on Fly release **28**, source
  `0d002e373f42c5a4a03100306a58efcc9156da2d`; signaling remains on release
  **36**. Both health endpoints pass, and Fly reports both releases complete.
  API, signaling, shared server modules and contracts have no source diff from
  the previous release. No service restart, credentials, session epoch, origins,
  volume, topology or contract migration was required.

## Publication, finality and integrity

The owner enabled the local signer. The publication wrapper required the exact
clean packaging SHA plus successful exact-candidate CI and signer-free release
validation before reading it. Only the publication child received the signer;
`finally` removed it from launchctl, and no seed was written to a file, process
argument, frontend configuration, CI or report.

Bulletin stored the stable content at block **1281826**, transaction
`0xe0cd818cfc7292f1244c4f48b7e8a6fde1f4ba49506406548785a14f7baaf134`,
then the root at block **1281829**, transaction
`0xf16ba07dfb0b76f33572521dc77e1c76927585113600e499e8f9b3a7af526540`.
All 24 storage chunks were confirmed at chain finality. Six initially pending
chunks finalized naturally after 31 seconds; no manual retry or duplicate
publication was needed.

Root content update finalized at Asset Hub block **14657783**, transaction
`0x9097f83cc3c90eec569bd51a488e34965a3ff30275958cff8dfe26028861cb9b`.
The atomic app content/executable update is
`0x52e13db21a122e3a476ba1a116957fc1e874ef9d1cd2b8f30294ce07348010c9`.
Independent finalized read-back at block **14657802** confirmed root and app
contenthash against the expected CID and executable
`{"$v":1,"kind":"app","appVersion":[0,1,56]}`.

The public gateway returned a **13,962,390-byte CAR**, SHA-256
`83e273e97d2e178462fdc20918a7c48647d598847d761ff33d1bc97cc65c1b61`.
All **125 block hashes** passed. The inner UnixFS directory root
`bafybeihnn4kcicdalncsllyxltugoljndtst7647od5iukwpod7nvk3afu` matches a
fresh local directory merkleization. Index and entry bytes match the signed
build exactly, including the full packaging SHA. This inner directory root
differs by design from the transport CID wrapping the chunked CAR.

## Validation and remaining gates

- [Merged-dev CI](https://github.com/knzeng-e/dotify/actions/runs/39324502489)
  and [exact packaging CI](https://github.com/knzeng-e/dotify/actions/runs/39329893526)
  pass all eight quality-gate jobs, including browser, Nearby, encrypted audio
  and Product identity checks. [Signer-free release validation](https://github.com/knzeng-e/dotify/actions/runs/39329734002)
  also passes. An earlier validation dispatch contained a mistyped expected SHA
  and stopped at checkout; the corrected immutable-SHA run is the cited evidence.
  CI performed no signing or upload.
- Local clean frozen build, 20 publication guards, six live DevNet endpoint
  checks and fresh Host Remote Config alignment pass. The public catalog is
  fresh, and all 13 release identities are unchanged. Existing bundle-size,
  dependency/audit and hook warnings are not claimed fixed by this release.
- Live Web smoke on desktop/mobile verified exact served source, the galaxy,
  a temporary Worldwide room, its profile preview, reversible Hide, no page
  errors/overflow and a 65,536-byte ciphertext Range read through browser CORS.
  No content key or plaintext was read. The temporary host was closed; health
  then reported zero rooms, listeners and solo sessions.
- The live mobile form smoke kept the room name, invitation and associated
  labels above a simulated 370 px visual viewport with a 30 px offset. Drafts
  survived keyboard closing. The form was dismissed without opening a room.
  This is browser geometry evidence, not a physical software keyboard pass.
- Installed **Polkadot Desktop Dev 0.1.3** opened
  `polkadot://app.dotify-test01.dot/`, rendered the catalog and the new room
  form with context-first focus and a Close button. Name/invitation text entry
  rendered correctly. Existing Host permissions were already allowed; none
  was changed. This bounded native desktop smoke does not certify mobile
  keyboard behavior or inspect the loaded JavaScript source SHA.
- Physical iPhone/Android and Product Mobile keyboard/rotation, first-tap after
  native keyboard closing, prolonged audio and funded native receipt/chat
  acceptance remain open. Follow the [form acceptance record](mobile-form-continuity-2026-10-19.md).
  Reopen Product and verify 0.1.56 before recording device acceptance. No funded
  contribution was submitted during this rollout.

## Rollback

The client rollback is **Product 0.1.55**, CID
`bafybeig5b2hue5db3oftgvjzlvb2wezslwdn7j5efj547225s4y4b5zwmy`.
Its root/app identity was independently confirmed at finalized block 14657589
before publication. Keep API 28 and signaling 36: both support this client and
the new presentation release. No backend restart or data migration is needed.
Web and Product have independent publication paths; verify their served source
and resolved executable separately after any rollback.
