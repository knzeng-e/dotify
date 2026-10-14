# Per-artist key recovery and alternative operator rehearsal

Issue: [#276](https://github.com/knzeng-e/dotify/issues/276).

Priority: P1. Track: Production spine. Phase: Next. Type: Work.
Scheduling: after W19's first reviewed Nearby implementation slice. Builds on
W07's synthetic recovery record without reopening its completed scope.

## Outcome and read first

An artist can recover encrypted releases and necessary keys, then use a second
compatible service which enforces existing on-chain access. Read `keyVault.ts`,
`routes/keys.ts`, upload services, W03/W07 evidence, canonical manifests,
`docs/explanation/content-protection.md` and deployment configuration.

## Scope and acceptance

1. Specify per-artist separable keys/envelopes, authenticated export authority,
   retained versions, migration of global-derived keys, backups and revocation
   limits. Runtime ownership transfer does not automatically authorize export
   of every historical work; define work-key authority explicitly.
2. Define a versioned encrypted export linking chain/runtime/content, cipher
   format, CIDs and key envelopes. Never export a global master secret, another
   artist's keys or protected keys to room guests. Keep package bytes out of
   public repositories, logs and artifacts.
3. Demonstrate synthetic export/restore with two independent operators: existing
   entitled listener succeeds, unauthorized listener fails and one artist
   cannot recover another's work. Preserve chain policy, canonical binding,
   nonce/session security and expiry.
4. Rehearse operator loss, retained-version restore, tampered/incomplete exports
   and unavailable storage. Name who renews Bulletin retention and retains
   encrypted mirrors/backups; CIDs alone do not guarantee availability.
5. Document the artist journey, trust boundaries, rollback and limits of
   revocation after an authorized party obtains a key.

Close the implementation issue after reviewed export/recovery behavior and the
synthetic second-operator rehearsal merge. Activating real artist-key migration
requires a separately scoped owner-approved recovery test. Do not claim full
sovereignty until the applicable real recovery path is proven.
