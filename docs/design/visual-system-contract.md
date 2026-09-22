# Dotify visual system contract

Status: implemented by W24. This contract is the source of truth for the Night
Console interface. Component sheets consume the tokens in
`web/src/styles/tokens.css`; they do not introduce alternate palettes or type
scales.

## Typography

Dotify uses eight size steps, all at or above 12 CSS px at the default root
size:

| Token | Value | Use |
| --- | --- | --- |
| `--text-xs` | `0.75rem` | Short metadata and compact state labels |
| `--text-sm` | `0.875rem` | Secondary copy, labels and controls |
| `--text-base` | `1rem` | Body copy and fields |
| `--text-lg` | `1.125rem` | Emphasized body copy |
| `--text-xl` | `1.25rem` | Compact section headings |
| `--text-title` | `1.75rem` | Card and panel titles |
| `--text-display-sm` | `clamp(2rem, 4vw, 3.5rem)` | Modal and secondary display headings |
| `--text-display` | `clamp(3rem, 7vw, 6rem)` | One primary narrative heading per surface |

Instrument Sans is the interface voice. Newsreader is reserved for narrative
page, artist, release and immersive player headings; it is not used for
controls, status, forms or technical proof. Large headings use
`--tracking-display` so letters remain distinct. The symbol-capable fallback
stack precedes platform fallbacks so artist names containing characters such as
`☥` remain legible when the primary face lacks a glyph.

Monospace is limited to values where alignment or exact identity matters:
addresses, hashes, room codes, durations, amounts and tabular figures. The
stack begins with `ui-monospace` and includes Apple, Windows, Android/Linux and
common developer-font fallbacks.

## Color roles

- `--action` and `--action-hover`: primary actions and their feedback.
- `--artist`: artist provenance and a small number of support markers. Pink is
  not the default color for names, links or generic headings.
- `--link` and `--link-hover`: textual navigation and proof links. Links retain
  an underline or another explicit affordance in their component context.
- `--live` and `--live-soft`: the only available/live-room green. A labelled
  state accompanies color; the pulse is brief and disabled by reduced motion.
- `--signal`: neutral informational, synchronization and focus-adjacent state.
- `--success`, `--warning` and `--danger`: outcome states only.
- `--ink`, `--ink-soft` and `--muted`: primary, secondary and supporting text.

Track aura may tint the canvas, but readable text remains on the deep canvas or
bounded surfaces. Aura does not replace a semantic state color.
The fixed mobile room shell retains an opaque keyboard-safe canvas, painted
with the same `--listening-background` as desktop. Its aura lives inside the
shell, above that canvas and below controls, so viewport fixing cannot mask the
track's light. System light/dark preferences do not select a different palette.

## Components and layers

Core controls use a 44 px minimum target. Secondary icons are 18 px, transport
icons 20 px and primary/navigation icons 24 px. Play triangles are filled in
every context; other Lucide icons retain their standard stroke.

Back navigation is a quiet text-and-arrow action rather than a bordered CTA.
Checkboxes share the same custom control, cyan selected state and global focus
ring. Status precedes the action that responds to it. Empty account details use
dividers inside one surface rather than cards nested inside cards.

Global stacking uses the named `--layer-*` tokens for the canvas, floating
entry, player, mobile composer/navigation, sheets, dialogs and skip link. Small
integer `z-index` values may still be used inside an isolated component such as
the galaxy, where they describe only that local drawing order.

## Responsive and accessibility contract

The same hierarchy must hold at 360, 390, 768 and 1440 CSS px. At 200% text,
content reflows without horizontal document overflow. Reduced motion removes
ambient drift and live pulses without hiding state. Focus remains visible, and
meaning never depends on color or motion alone.

Chromium and WebKit automation verify the symbol fallback and layout contract;
physical iOS, Android and Product-host font availability remain release-device
checks. Contrast evidence is recorded with the W24 implementation evidence.
