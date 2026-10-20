# Room clarity and catalog suggestions — 2026-10-10

Owner-requested follow-up under W29 / #250 and room reliability #89, included
in Product 0.1.45 (PR #256). The release is published from tested `dev`
`b45c2f700c2c36eed06d23dad2ea51c917842c80` at CID
`bafybeicrl7vkxowvwddmptksezhzvop7xwxl7mwk6ptoxxtdwsmfn5mcfq`.
Publication and public-wrapper loading are verified; physical Product/device
validation remains pending.

## Visible changes

- Chat, queue and people tabs use familiar icons, with screen-reader names,
  tooltips, keyboard navigation and the selected-tab state preserved.
- Chat displays a numeric unread badge for new messages from other participants.
  Reading the latest messages clears it. Own messages, initial history and
  repeated server snapshots do not add unread counts; seen ids are bounded.
- The header invitation opens the sole share/copy/QR surface. The duplicate
  People-panel actions are removed. The dialog's QR action says Enlarge QR.
- Track suggestions search the available active catalog as the user types, by
  title and artist with accent-insensitive matching. Result rows show artwork,
  title and artist. The user selects a catalog result before sending. No result
  means no matching track in the available catalog, not proof that the song does
  not exist anywhere. Existing text requests remain visible.
- Up next is the host's playback order, distinct from suggestions. Its native
  dropdown becomes the same searchable visual picker, bounded to six displayed
  results. The host can add an unambiguous catalog-backed suggestion to Up next;
  absent, inactive or ambiguous matches cannot activate a playback action.
- DAV2 preparation stages display Loading your track instead of gateways, byte
  ranges, audio maps and fallback paths. Technical telemetry remains intact.

## Boundaries and review map

`RoomTrackSearch` presents local catalog rows; `roomCatalogSearch` owns matching
and bounded request text. No new search backend or external catalog is queried.
The existing signaling service remains authoritative for suggestions and room
lineup. Requests are still bounded text (120 characters), not new network ids.
Matching that text never establishes entitlement: opening a queued track still
uses the normal access/key pipeline. Ambiguous text has no host add action.

`chatUnread` counts unseen ids, while `RoomChat` applies the reader's tab and
scroll-following state. Switching panes preserves chat and request drafts and
does not remount the audio. `useRoomViewport` includes the new search form in
keyboard occlusion detection. Queue and result lists have bounded scrolling.

## Validation

Unit coverage exercises accent-insensitive matching, inactive/unmatched and
ambiguous requests, text bounds, own-message exclusion, repeated snapshots,
history rollover and clearing unread state. Browser scenarios exercise actual
signaling between host and guest, numeric unread badges, draft preservation,
catalog selection, a single invitation surface, protected-track access gates,
lineup playback and mobile keyboard geometry. The unit suite passes 108 files /
852 tests. Ordinary and frozen Product builds, formatting, lint (two existing
App warnings), backlog consistency and whitespace checks pass. The 53-scenario
Chromium room/mobile suite passes with one worker. Parallel attempts exposed
intermittent browser-context teardown/media failures; they passed on the serial
run. A separate guest-suggestion-to-host-curation test covers the new action.

Real installed Product Desktop/mobile UX and screen-reader observations remain
unverified. The recovery wire baseline and payment trust boundaries remain the
same as the preceding fix in this PR.
