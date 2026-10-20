# Product 0.1.54 stability candidate - 2026-10-18

- Application base: `02bb83595754672870d136d743509e718117faa1`, merged #302.
- Candidate identity: this release branch's packaging commit, executable `[0, 1, 54]`.
- Profile: existing `product-cdm` / `devnet`, `dotify-test01.dot`, unchanged contracts and permissions.
- Frozen catalog: 13 public releases, refreshed from the fresh public API snapshot with no further pagination; the strict generator and offline fixture match.
- API/signaling must precede Product. The API relay holds registered encrypted media only, with bounded concurrent reads, cache and outgoing responses. Last-subscriber cancellation frees abandoned upstream work; access/key checks remain separate.
- Nearby retains an existing valid lease on transient refresh failure without extending expiry from old coordinates. Semantic track identity avoids duplicate chat announcements during same-release recapture.
- Radar cover size and halo brightness follow real connected presence, host included, with bounded mobile/dense sizing. Entry asks for a name or nickname and does not repeat a selected room code.
- Keep one API writer and one signaling worker. Preserve the stable API session epoch and every content-key secret; no new service, credential, volume or paid provider is introduced.
- Before restarting either service, verify zero rooms/listeners/solo listeners in the live signaling health response and record the previous image for rollback.
- Product 0.1.53 CID `bafybeihj6vrdu3dqnaqfofw4l3qiysc4by4rau3mldmlom637waemgmqr4` is the intended client rollback. Keep privacy-safe v4 signaling on client rollback.
- Native Host location, background audio and prolonged multi-track listening remain physical acceptance gates. Publication and browser fixtures cannot establish them.
- No publication or completed deployment is claimed by this candidate record. The separate rollout record must bind service images, Web SHA/configuration, Product CID, finalized read-back and remaining acceptance.
