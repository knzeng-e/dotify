# Mobile form continuity captures

Selected Playwright WebKit captures from 2026-10-19, with synthetic release
metadata. These are browser renderings, not physical iPhone or Product evidence.
See the [validation record](../../backlog/implementation/evidence/mobile-form-continuity-2026-10-19.md).

- [320 px sheet](webkit-320-sheet.png): quiet close action, track context and
  scrollable sheet before editing.
- [320 px keyboard simulation](webkit-320-keyboard.png): invitation and its label
  remain inside the 300 px visible height.
- [390 px, 200% text](webkit-390-large-text.png): the preview reflows vertically
  without horizontal overflow; the sheet scrolls to the remaining content.
- [Landscape keyboard simulation](webkit-landscape-keyboard.png): field and
  label fit in the 220 px visible height.

Images use the browser's screenshot pixel density. In simulated keyboard images,
the content below the visible-height boundary would be covered by the keyboard
on a real device. No keyboard bitmap was added and no native result is implied.
