# Dotify guide and release details

Owner feedback, 2026-10-11. The illustrated guide remains a content proposal.
The structured release metadata and in-app release sheet described below are
implemented in PR #263 for the next test-data reset.

## Audience and guide format

Listeners should be able to join, participate and support an artist without
learning blockchain vocabulary. Hosts need to curate and invite. Artists need
to publish, understand real earnings and meet the people listening to them.

Recommended guide format: a mobile-first web guide in the existing documentation
site, with accessible illustrated pages and a print stylesheet for a dated PDF.
Keep one content source so screenshots, steps and exported PDFs do not diverge.
Start in French with the current English button labels; an English edition can
share the same structure.

| Part                     | Reader outcome                                                             | Illustrations                                         |
| ------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| Your first shared listen | Open an invitation, choose a room name and hear the host                   | Three real mobile screens with numbered callouts      |
| Participate in a room    | Chat, reply, mention, suggest a track and return to unread messages        | Chat / Queue / People and a short swipe sequence      |
| Host a musical moment    | Create, invite, curate Up next, manage suggestions and close the room      | Host and guest views side by side                     |
| Support the music        | Distinguish access, tips, artist gifts and optional host share             | Actual quote and confirmation with test data labelled |
| Publish a release        | Prepare assets and credits, choose access, review recipients and publish   | Artist wizard and resulting release sheet             |
| Meet your listeners      | Find rooms playing your releases and choose an ordinary or announced visit | Overview and visit choice                             |
| Understand your earnings | Separate generated, received and claimable amounts                         | Annotated artist dashboard                            |
| When something blocks    | Recover connection, playback and uncertain payment safely                  | Symptom / meaning / next-action cards                 |
| Controls and terms       | Understand icons, permissions, temporary room data and account prompts     | Role-aware glossary                                   |

Generated campaign phone screens are mood references. Every instructional click,
label, access condition and payment example must use a current real screenshot.
Use the human train, cafe and public-space scenes for chapter openings, with alt
text and written instructions. Do not infer nearby discovery, listener identity
or measured analytics from an illustration.

## Delivered release metadata

The artist publication wizard now keeps the story separate from standardized
release facts. **More release details** collects optional fields without making
the publishing path feel like a database form:

- release type, album or EP, version and original date with year-only precision;
- duration measured from the selected audio file rather than copied into prose;
- up to eight artist-entered genres and languages;
- up to twenty named credits with a bounded role vocabulary;
- label and recording or production location;
- explicit-content declaration, ISRC, copyright and master notices.

The backend accepts the strict `dotify.track.v2` manifest and rejects unknown or
malformed fields. The normal catalog remains chain-derived. Opening a release
loads its editorial facts from the on-chain `metadataRef`; a failed IPFS read
hides those optional facts without changing or inventing the authoritative
access price, personhood rule or payment recipients.

This iteration intentionally targets a clean test-data reset. It does not parse,
convert or migrate prose from earlier manifests. Old releases can still expose
their chain identity and listening policy until the reset, but rich editorial
sections require republishing with `dotify.track.v2`.

## Delivered release sheet

The application presents information in this order:

1. artwork, title, artist and compact release highlights;
2. listening access from the runtime;
3. **About this track**, preserving the artist's paragraphs;
4. release details in scannable fact cards;
5. artist-declared credits and notices;
6. listening and support terms, including confirmed value recipients;
7. content hash, metadata reference and account records on demand.

Artist-entered credits are labelled as declarations and never presented as
independent proof of legal ownership. Descriptive metadata cannot override the
runtime's financial routing or access policy.

## Remaining guide work

Build the guide after a stable release, capture the real web and Product screens,
verify each listener/host/artist recipe, and generate its printable PDF from the
same source. The room interaction implementation is documented in
[Live room conversation](../explanation/room-live-conversation.md).
