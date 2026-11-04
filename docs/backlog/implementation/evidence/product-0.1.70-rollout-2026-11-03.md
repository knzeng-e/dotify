# Product 0.1.70 and exact metadata-repair admission — 2026-11-03

Refs W33/#288; merged #381/#382, with the deployment/recovery records #378/#380
reconciled first. Exact candidate source is
`5c25685db3ed6b0f21e14e3c3c60c2b4da4c66dd`, based on dev `16f834b5`.
[Candidate CI](https://github.com/knzeng-e/dotify/actions/runs/41675787558) and
[base CI](https://github.com/knzeng-e/dotify/actions/runs/41675229276) are green.

## Current execution checkpoint

The owner approved this exact new allowance and custody maintenance. Web,
Product 0.1.70 and all existing API roles now serve the verified candidate;
the one-name repair permit is installed. Product used **13 new stores /
3,582,498 bytes**, reused seven blocks and made exactly two DotNS signing
requests. Independent readback reconstructs the exact CAR and checks both app
records, unchanged lab records and public gateway bytes. The local signer was
removed immediately after capture; empty launchctl state is verified after exit.
Corrected metadata upload, artist registration and protected device acceptance
remain pending. This rollout sent no music metadata or registry transaction.

## Scope and authority

This update deploys the required release-text checks and editable artist name,
plus the maintenance-only repair from [ADR 0045](../../../adr/0045-bounded-metadata-name-repair.md).
The permit admits only **Unknown artist → Thot Nzeng** for the original synthetic
pilot, preserving title, description, original timestamp, access/royalties and
all audio/cover references. Old metadata and every receipt/allowance remain.
There is no new runtime, service, subscription, signer installation, Pinata
operation, audio recovery, renewal or broader artist publication allowance.

Installing the permit submits no storage transaction and does not update the
registry. The normal authenticated artist request must store the corrected
metadata, and the artist still approves registration in their wallet. Deployed
code, successful storage and protected listening acceptance are separate gates.

## Candidate and verified operations

- Product CAR: 9,402,390 bytes; SHA-256
  `9e20bfa734da691e196dd50cb2fd62704d524e91d515f5827dd9edc164f52527`.
  Offline verification authenticates 99 inner blocks, byte-compares 71 files
  and verifies all 20 outer transport/icon blocks. Repeat merkleization matches.
- Verified Product storage root:
  `bafybeicg7qzdapmxdon5hern3qmdguut26htc5i6rpvxpludzptu4tuiyy`.
  Domain ownership, branding and both diagnostic lab records remain intact.
  Finalized new-store nonces are **1095–1107**, next nonce **1108**; no uncertain
  intent remains. Every new/reused block is independently authenticated, and
  gateway delivery returns HTTP 200 with the exact 9,402,390-byte CAR hash.
- API image:
  `registry.fly.io/dotify-api@sha256:b01d0391c888ef1cb9c41eddb51bcacfec95ded34cc210dd21ae51385c40abf7`.
  Both existing public edges and private custody serve source `5c25685d` and
  report HTTP 200 / ready. Database identity, session epoch, CORS, mounts,
  installed keys and machine count are unchanged.
- Netlify production deploy
  [6aea12a8bb14afb0641f7b7b](https://app.netlify.com/projects/muzinga/deploys/6aea12a8bb14afb0641f7b7b)
  completed from `release/product-0.1.70`. Independent canonical HTTP readback
  finds the exact source in `/assets/index-Bf0_2jBF.js` (1,117,109 bytes;
  SHA-256 `e8b0155c7fdef3def7db7835b86a7596df7af7593eac81538df9f961d4a020ed`).
  Keep that publication branch frozen; this record uses a separate branch so
  editing documentation cannot silently replace the validated Web candidate.
- A new volume snapshot `vs_ByDpoRDyJNpBSv7DpVG02` and coherent private state copy
  preceded admission. The copy is
  `/data/contributions/recovery-backups/metadata-0.1.70-1793724978375`.
  These stay within existing Fly storage. A same-volume copy does not prove
  independent disk-loss restoration; snapshots can contain the previously
  installed full-authority storage/DotNS key. No key was exported or reinstalled.
- With custody stopped gracefully, inspect/admit bound the immutable permit to
  plan SHA-256 `228415c90a3e061574495567a5974024896cea68f61213f577144de245e3bc72`.
  Canonical finalized/latest checks confirmed the expected artist/runtime and
  explicit unregistered state. The normal command was restored and readiness
  checked. The original audio remains ready at three attempts, all three old
  inventories remain ready, and admission leaves nonce 1095 unchanged.

Old metadata root:
`bafykbzacecahgvcz7wh4i7xozrdqphf5sr2jwgduxdsi2vouhxqmmos7gjhly`.
Exact additional graph:
`bafykbzacebluyf4rmu6mkwra2efvrfrjmj5zapclathgknwi3avkimykqw6ug`
(two blocks / 1,101 bytes). At admission, it has not been stored or registered.

## Budget, retention and remaining gates

The new authorization bounds Product and corrected metadata together at **22
stores / 9,440,345 bytes**, with at most two DotNS signing requests. Product's
individual bound is 20 stores / 9,439,244 bytes; the metadata exception is exactly
two / 1,101. Read-only preflight authenticated seven reusable Product blocks;
the finalized journal/readback confirms 13 new stores / 3,582,498 bytes.

Reserve 171 retained renewal transactions / 44,750,154 bytes plus 22 future new
renewals / 9,440,345 bytes. The initial gate required 215 available transactions,
9,440,345 store bytes and 54,190,499 renew bytes. Observation showed 276,
79,064,254 and 106,084,254 respectively. Authorization expiry (1,621,405) and
the earliest pilot dependency expiry (1,679,653 at head 1,489,306) remain separate
clocks. All 26 existing pilot blocks / 734,495 bytes were authenticated and their
retained receipts matched; no uncertain intent existed. No renewal is submitted
or scheduled by this rollout. Final quota is 263 transactions, 75,481,756 store
bytes and 106,084,254 renew bytes at head 1,489,928; this covers the two pending
metadata stores plus retained renewal obligations.

The **Product graph has an earlier deadline than the pilot media**: reused
blocks retain their original expiry. Its earliest dependency expires at block
**1,532,185**, only **42,257 blocks** after the final observed head. Reuse did not
renew it. These app dependencies must join the next bounded conservation work;
a freshly stored root does not give its whole graph a fresh retention window.

Next: resume the preserved artist draft with **Thot Nzeng**, retaining every
other detail. The normal upload path
must produce the exact corrected graph before artist-approved registration.
Verify sender/nonce receipts, on-chain metadata reference and protected allowed/
denied Web/Desktop/mobile listening. Conservation monitoring, bounded renewals,
off-volume recovery and representative performance/cost evidence remain W33
acceptance gates. Never rerun prepared-audio recovery or delete old inventories,
locks, permits or security/nonce state to retry.
