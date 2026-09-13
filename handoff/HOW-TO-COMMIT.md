# Files to commit on top of `dev`

Branch suggestion: `docs/readme-brand-and-screenshots`

## New files

| Repo path | From this folder |
| --- | --- |
| `brand/` (whole folder) | `handoff/brand/` |
| `docs/images/dotify-catalog.png` | `handoff/docs/images/dotify-catalog.png` |
| `docs/images/dotify-rooms-galaxy.png` | `handoff/docs/images/dotify-rooms-galaxy.png` |
| `docs/images/dotify-room.png` | `handoff/docs/images/dotify-room.png` |
| `docs/presentation/dotify-showcase-2026.pdf` | export the deck to PDF and drop it here |

## Edited files

`README.md` - apply the five edits in `README-CHANGES.md`.

## Commands

```bash
git checkout dev && git pull
git checkout -b docs/readme-brand-and-screenshots

# copy brand/ and docs/images/ from this folder into the repo root, then
git add brand docs/images docs/presentation README.md
git commit -m "docs: reframe README around shared listening, add screenshots and brand assets"
git push -u origin docs/readme-brand-and-screenshots
gh pr create --base dev --title "docs: README reframe, screenshots and brand assets" --body-file handoff/PR-BODY.md
```
