# Dotify guide and track details — proposal

Owner feedback, 2026-10-11. This is an outline for discussion, not a published
user guide or a delivered metadata migration. The accompanying room UI patch
is described in [Live room conversation](../explanation/room-live-conversation.md).

## Audience and format

Listeners should be able to join, participate and support an artist without
learning blockchain vocabulary. Hosts need to curate and invite. Artists need
to publish, understand real earnings and meet the people listening to them.

Recommended format: a mobile-first web guide in the existing documentation
site, with accessible illustrated pages and a print stylesheet for a dated PDF.
Keep one content source so screenshots, steps and exported PDFs do not diverge.
Show the tested app version and revision date, with separate notes where the
browser wallet and Product app differ. Start in French with the current English
button labels; an English edition can share the same structure.

## Proposed contents

| Part | Reader outcome | Illustrations |
| --- | --- | --- |
| Your first shared listen | Open an invitation, choose a room name, hear the host; explain when no account is needed | Three real mobile screens with numbered callouts |
| Participate in a room | Chat, reply, mention, suggest a catalog track, return to unread messages, use activity filtering | Chat / Queue / People, plus a short swipe sequence |
| Host a musical moment | Create, invite by link/QR, curate Up next, manage suggestions, close the room | Host and guest views side by side |
| Support the music | Distinguish listening access, track tips, artist gifts and an optional host share; read a receipt | Actual quote and confirmation, with demonstration data labeled |
| Publish a release | Prepare assets and credits, select access, review recipients, publish and verify the result | Artist wizard and resulting track page |
| Meet your listeners | Find rooms playing your releases; Join with or without an announced artist visit | Overview, visit choice and verified welcome |
| Understand your earnings | Separate generated, received and claimable amounts and transaction records | Annotated dashboard using real definitions |
| When something blocks | Recover connection, playback and uncertain payment without sending a duplicate payment | Symptom / meaning / next safe action cards |
| Controls and terms | Quick reference for icons, permissions, temporary room data and account/session prompts | Compact role-aware glossary |

Tutorials should lead to a successful first listen. Task recipes should stand
alone for returning users. Keep the icon/term reference and the explanation of
rights and access separate from the step-by-step instructions.

## Visual direction from the supplied campaign images

Use the human scenes in the train, cafe and public square for chapter openings:
they express shared presence and the direct artist/community relationship.
Reuse the deep blue foundation, restrained pink and cyan action accents, and
the familiar dotted music logo from the actual brand assets.

Generated phone screens are mood references, not instructions. Replace them
with actual screenshots for every click, label, access condition and payment
example. Keep one canonical logo and consistent typography; the supplied
campaign variations should not become different identities inside the guide.
Use alt text and numbered captions, with the instructions available as text.
Do not imply nearby discovery or measured listener totals from an illustration.

## Track page: story first, facts and credits separately

The current publication form stores a free-text description. The screenshot
illustrates its limit: album, author, composer, year and production details are
flattened into one paragraph. Inventing a parser for arbitrary historical prose
would risk presenting incorrect credits as verified facts.

Proposed reading order:

1. Artwork, title, artist, reliable duration and the existing Tip action.
2. **About this track**: the artist's short story, context or release note.
3. **Release details**: album/EP/single, release date or year, genres and languages.
4. **Credits**: named contributors and their roles, production and recording context.
5. **Listening & support**: authoritative access terms and payment recipients.
6. **Release records**: technical identifiers available on demand.

## Proposed metadata contract

| Information | Collection | Presentation / authority |
| --- | --- | --- |
| Title, primary artist, artwork | Existing identity fields; validate before publish | Canonical release identity |
| Duration | Measure the uploaded audio; retain source and missing state | Do not repeat it inside prose or substitute a made-up value |
| Short description / story | Separate free-text field with paragraphs | Escaped text, never raw HTML |
| Release kind, album/EP, version | Optional structured fields | Omit empty fields; distinguish original/live/remix versions |
| Original release date | Optional date with year-only precision allowed | Separate original release from date published to Dotify |
| Genres and languages | Optional bounded lists | Normalized identifiers with human-readable labels |
| Credits | List of name + role: performer, lyricist, composer, producer, etc. | Artist-declared credits, not independently verified identity |
| Label, recording/production location | Optional artist-entered fields | No inference from a name, wallet or cover |
| Lyrics, explicit-content flag, identifiers such as ISRC | Optional and separately validated | A known absence differs from an unanswered field |
| Copyright / master notices | Separate optional notices | Artist declarations, not proof of ownership |
| Access, price, support and royalty recipients | Existing runtime/catalog policy and confirmed quote | Never override financial routing with descriptive metadata |

Begin with album, date/year, genres, languages and credits. Avoid a long mandatory
form: only the existing publication requirements block publishing. Keep optional
editorial fields grouped behind **More details** with a preview of the track page.

Implementation needs a versioned metadata schema, backend upload validation,
catalog read-model support and a backward-compatible renderer. Preserve old
descriptions verbatim. A suggested conversion may be offered later for artist
review, but must never silently rewrite a published credit or pretend to mutate
immutable release records. Check the actual update/versioning path before
promising that an existing release can be edited in place.

For “Mon cerveau”, the supplied text can illustrate the proposed layout with
album “Petit Mutant dans son coin”, year “2020”, genre “Hip Hop/Rap”, author and
composer labels as entered, and the production note kept as a separate field.
These are examples supplied by the owner, not an independently verified catalog
update. Do not invent lyrics, dates, identifiers or contributor roles.

## Next delivery boundaries

1. Review this outline and choose the web guide + printable PDF approach.
2. Build the guide against a stable release, capture the real screens and verify
   each listener/host/artist recipe on ordinary web and Product as applicable.
3. Implement metadata as its own change across publication, validation, catalog
   and display, with legacy-release coverage and explicit update semantics.

The room interaction patch introduces neither a new metadata format nor a
published guide. The last supplied screenshot also shows an access-confirmation
failure: it must be investigated with its request/error evidence if it persists,
not treated as something a guide or descriptive metadata can repair.
