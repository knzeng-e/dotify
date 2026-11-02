# Publishing without a storage-provider choice, 2026-11-02

Refs #288 ([W33](../W33-media-edge-cache.md)) and #287.

## Result and boundary

The release wizard no longer offers an optional public Bulletin archive or a
Substrate/development signer selector. Publishing keeps one canonical metadata
reference returned by the existing upload service. Audio, artwork and metadata
preparation still precede the artist's normal runtime registration approval;
confirmed catalog visibility still determines publication success.

The removed checkbox wrote a second compact manifest directly from the client.
It did not select the server's audio provider, replace Pinata artwork/metadata,
or renew stored data. Hiding that checkbox alone would leave the duplicate
upload/signature branch reachable; this change removes the branch, its draft
state and its wallet-provider development-account fallback as well. Catalog
selection no longer writes an unread archive ref. Advanced details show the
selected track's actual metadata reference instead of a next-release archive
flag. Existing persisted track fields and readers are unchanged.

Storage routing remains an operator setting. The server-side Bulletin artwork/metadata path
merged in #376 during implementation. This cleanup neither activates
that configuration nor broadens the existing single-release allowance. The
current server configuration remains authoritative, including explicit failures;
removing a UI choice does not make all providers or publications available.
No key custody, access checks, signatures, journal, budgets or recovery barriers
are relaxed. No live upload, deployment, renewal or Capacity call is required.

## Review path

1. `web/src/hooks/useArtistConsole.ts`: asset preparation -> canonical metadata
   upload -> existing artist registration -> catalog confirmation. There is no
   second client Bulletin manifest or signer requirement between these steps.
2. `NewReleaseTab`, `AdvancedTab` and the release/wallet providers: provider
   choices and stale signer/archive state disappear together; actual account,
   royalty, access and metadata details remain.
3. The preparation regression supplies a retired flag and no Substrate signer,
   while spying on the old archive functions. Retrying a cover failure must reuse
   prepared audio, reach the configured publication boundary and make no archive
   call. The browser publication tests retain artist approval, exact upload counts,
   failure recovery and listener catalog visibility.

## Validation

Validated on `ae48afda`, rebased onto `dev` `b8e18ca8` (including #376):

- `npm run test:unit`: **138 files / 1,058 tests pass**, including the obsolete
  flag/no-Substrate-signer regression and canonical asset-reference tests.
- `npm run test:e2e -- e2e/artist-publish.spec.ts`: **22 pass**. Covers artist
  registration, one upload per asset, listener visibility, upload/transaction
  failures, delayed confirmation, disconnect recovery, mobile return and
  320/390/430/1440px navigation with enlarged text. Listening-step assertions
  confirm no archive checkbox or development-signer selector remains.
- `npm run build` and `npm run build:product-devnet:frozen`: pass. These build
  checks do not publish or change the Product identity.
- `npm run lint`: zero errors, two existing App effect-dependency warnings.
  Existing large-bundle warnings remain. Changed TypeScript files pass Prettier;
  changed documentation has no unresolved local links; `git diff --check` passes.

An initial browser run before the rebase had one timeout while creating the
artist profile: the consent checkbox was unchecked before the profile button
could be activated. It failed before any upload. The complete run on the final
base passes without changing consent behavior or weakening an assertion.
No physical Host, live storage, registration, renewal or deployment was tested.

## Next gates

The owner chose to stabilize Bulletin; Capacity stays a research topic with no
integration or new network trial. Complete and deploy the reviewed public-asset
path before retrying the existing bounded pilot. Preserve its saved encrypted
artifact and cumulative attempts/allowance during recovery.

Then expose operator-visible conservation status for every graph dependency:
retention deadline, account authorization expiry, remaining store/renewal quota
and unresolved submissions. A renewal reserve is not a scheduler. Implement
bounded, durable renewal only after that inventory is reviewable, and verify
restoration from an off-volume copy with separate key recovery. Protected
Web/physical Host playback and measured representative costs remain acceptance
gates; this UI cleanup does not close W33 or promise permanent availability.
