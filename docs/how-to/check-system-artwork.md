# Check delayed lock-screen artwork

Use an existing release on a matching Web/Product client. This check needs no
new publication, purchase, account permission or protected-key export. Its purpose
is to find whether a delayed cover is still being prepared by Dotify or is already
registered while native display remains late.

1. Record Dotify's version/build, device, browser or Polkadot app/runtime version,
   network and whether this is solo or Room. Test both modes separately. Use the
   same existing track for comparable observations.
2. Start once and lock the phone. Note whether the actual cover and bottom-right
   Dotify badge appear with the correct title/artist, and roughly when. Do not
   confuse a moving bar or a submitted metadata object with audible sound or a
   visible cover. Note whether host and guests still hear the music in Room.
3. Unlock, open **You → About Dotify → Listening support → Copy support report**,
   and retain that report with your observation before reloading. If clipboard
   access is refused, select/copy the displayed report. Nothing is sent automatically.
4. Repeat after reopening the same player, then with a different track. Label
   these warm runs honestly; Host/browser cache state may be unknown. Verify that
   the old title/cover never returns after a rapid change.
5. Disconnect while a cover is still pending. The protected player must stop as
   its existing access policy requires; delayed image completion must not restore
   old system metadata or controls. Reconnect and explicitly choose playback again.

Read the report's [`artwork` observations](../reference/system-artwork-observations.md).
A long image-acquisition interval suggests work before composition. A long decode
or composition interval suggests browser image processing. A prepared-PNG
publication before the observed visual delay shifts the investigation toward the
native presentation boundary; it does not prove a Host/iOS defect. Missing early
phases may have been evicted and cannot be treated as successful zero-duration work.

Also record which native controls are visible and what previous/next actually do
with a meaningful queue. Page registration does not determine OS button glyphs.
If hosting, test lock/unlock during preparation as well as after guests hear sound.
Begin with a short lock, then an extended/full-track run. Keep failures and retries;
a single successful lock does not establish reliability or a latency percentile.

[Issue #388 scope](../backlog/listening-controls-and-discovery.md) owns remaining
acceptance. This guide prepares that check; it does not claim a deployed fix or
resume the deferred independent-recovery rehearsal.
