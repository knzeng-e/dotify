# Publication details checked before metadata storage — 2026-11-02

Refs W33 / #288; branch starts at tested dev `b7f539f8` (#379).

## Report and cause

The owner reached publication approval for “Bulletin pilot - 8s”, then Product
CDM simulation rejected `musicRegRegister` with `MusicRegistry: missing artist
name`. The review already said “By artist name needed”, but allowed submission.
The existing-runtime release editor did not offer an artist-name field. Its
publication handler checked the audio hash and royalty split, not the required
text, before storage. The public manifest substituted `Unknown artist` while
registration sent an empty name. The contract correctly refused the latter;
there is no reason to weaken that requirement or invent an artist identity.

## Correction

- Details exposes the artist name, using the existing account-local name update
  handler. Title, name and About this track are visibly required.
- The review shows actionable field errors and a direct return to Details.
  Publication stays disabled until music and text are valid; free wizard
  navigation remains possible. Audio and cover still prepare eagerly when
  selected, independently of publication text; this correction preserves that
  existing background preparation behavior.
- The publication handler repeats validation before its runtime reads,
  wallet/upload identity, additional audio preparation or metadata storage,
  including UTF-8 limits from
  `LibMusicBounds` (800 / 800 / 8,000 bytes). This also covers direct callers.
- Metadata and registration use identical trimmed text, without `Unknown artist`
  or `Untitled` substitutions. Invalid attempts leave prepared audio/cover refs
  untouched; correcting text can reuse them.

The contract and canonical artist authority remain authoritative. No API schema,
storage policy, nonce journal, key, setting or deployed artifact changes in this
PR. The local name cache is convenience, not proof of artist authority.

## Existing pilot: a separate metadata repair remains necessary

Read-only custody inspection confirms the original pilot scope and all three
ready inventories, with no pending submissions or active job; next nonce 1095:

| Asset | Finalized stores | Attempted bytes | Root |
| --- | ---: | ---: | --- |
| Audio | 16 | 712,737 | `bafykbzacedt5ltqhhtsffynpcfusxpxd6dlifcfsoyl6cld53lacraduyo2lw` |
| Cover | 8 | 20,653 | `bafykbzacedkn3434glr32ntnw2eaopqkwdiio7mhk2k4uqbgqkd5cgaoukxz6` |
| Metadata | 2 | 1,105 | `bafykbzacecahgvcz7wh4i7xozrdqphf5sr2jwgduxdsi2vouhxqmmos7gjhly` |

The saved public manifest has `artistName: "Unknown artist"`; the owner selected
**Thot Nzeng** for the correction. `preservePublicMetadata` deliberately permits
only a timestamp change on retry, and the policy admits one immutable metadata
graph. Simply editing the name and retrying on the current deployment cannot
replace it. Do not discard the draft or ask the owner to re-upload the sound.

Before retrying this particular pilot, prepare and review an explicit metadata
revision path: bind the old root and exact corrected manifest, preserve every old
receipt and renewal obligation, verify that registration has not occurred, and
admit only that new graph under a separately approved store/byte allowance.
Keep audio, cover, queue attempts, original cumulative counters and account nonce
history. No sidecar deletion, policy reinitialization, budget reset or generic
metadata-edit permission is authorized by this frontend correction. Replacement
implementation, exact-source rollout and the owner's new-write approval remain
gates; this PR does not perform the repair or claim the pilot is published.

## Publication time

Bulletin publication includes finalized block stores and canonical receipt
verification; this differs from a Pinata HTTP acknowledgement. The screenshot
and this inspection do not measure end-to-end latency or its dominant stage.
Instrument encoding, audio/cover/metadata storage, receipt verification and
wallet/catalog waiting separately before deciding what can be optimized. A
long wait is not accepted as unavoidable, and read speed does not establish
publication throughput or recurring cost.

## Validation and remaining acceptance

- Full frontend suite: **1,067 tests / 139 files passed**.
- Existing artist-publish browser cases: **22 passed**. The added repair case
  passed separately at 390 px after correcting its step-button selectors and
  accounting for existing eager audio/cover preparation (23 cases verified).
- Web and frozen Product DevNet builds pass; lint has no errors and retains
  the two pre-existing `App.tsx` dependency warnings. Existing bundle-size,
  Browserslist and server-rendered hook-test warnings remain visible.
- Changed-file formatting, backlog consistency, relative documentation links
  and `git diff --check` pass.


Targeted unit tests cover empty/whitespace details, exact UTF-8 boundaries,
no side effects before rejection, retained prepared uploads after correction,
and equality of manifest/registration text. The browser regression exercises an
existing artist clearing their name, disabled publication without additional uploads or metadata storage,
repair in Details and one ordinary successful publication. Web and Product
DevNet builds use the same validation code. These are local fixtures, not a live
registration or physical Host test.

Keep W33 open for the existing-manifest repair, real wallet registration,
protected allowed/denied Web and physical Host listening, representative
publication costs/startup, recurring retention and off-volume recovery.

## CI fixture correction — 2026-11-03

The first full CI browser run passed 284 cases and failed the two preparation
retry cases in `publication-review.spec.ts`. Their hook harness supplied an empty
track note, so required-text validation correctly stopped before the simulated
preparation began. The fixture now supplies a valid synthetic note. Production
validation, retry assertions and timeouts are unchanged. All four publication
review/recovery cases pass locally, including current-draft/account revalidation
and preservation of another task's dialog; fixture formatting and diff checks pass.

The next full run confirms both repaired retry cases and passes 285 cases, but
exposes an independent Tip hover measurement race at 430 px: viewport `y` changes
by 12 px while `x`, width and height remain equal. Player mount scrolling can
outlive visibility; the screenshot/hover sequence compared different viewport
positions. The test now waits for fonts and compares exact document coordinates
before/after hover, retaining viewport-fit, 44 px target, color, contrast, focus,
tip/payment and unchanged-access assertions. All four widths (320, 390, 430 and
1440 px) pass three repetitions, **12/12**. No product CSS, timeouts or acceptance
tolerances change.
