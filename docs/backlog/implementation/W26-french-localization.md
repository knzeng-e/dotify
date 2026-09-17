# W26 — Offer Dotify in French

Copy this entire file into an agent working in the Dotify repository, or use the launcher in README.md.

## Agent assignment

Implement **W26** only after the owner moves #181 out of the Later phase. Read `AGENTS.md`, `docs/backlog/implementation/common.md`, and the files below before changing code. Follow the common execution contract, including the evidence/handoff record.

- Branch: `feat/french-localization` created from the latest tested `origin/dev` when work starts.
- Dependencies: W13, W24.
- Release stage: Later (owner decision 2026-09-17).
- Existing issue: #181.
- Product purpose: effortless shared listening, meaningful artist control, transparent value, and a coherent poetic interface. Product DevNet is a first-class target alongside ordinary web.

## Outcome

French-speaking listeners, hosts and artists can use Dotify in French.

## Read first

- `docs/design/ux-design-audit-2026-09-17.md` (finding UX-50)
- W13 pilot evidence for the languages participants actually used
- `web/index.html`, `web/src/app`, `web/src/views`, `web/src/components`
- `web/src/shared/utils/format.ts` (dates, amounts)
- Product host documentation for any exposed locale

## Work sequence

1. Confirm the language decision with pilot evidence and the owner before choosing a library; prefer no new dependency if a small typed message catalog is sufficient.
2. Extract user-facing strings, including errors, receipts and accessible names. Keep e2e selectors independent of language.
3. Provide French and English, default from the browser or Product host language, remember an explicit choice, and set `lang` accordingly.
4. Localize number, amount and time formatting; never translate artist-provided metadata automatically.
5. Check long French strings in every layout from W24.

## Acceptance and meaningful verification

- Listener, room and artist journeys usable in French at 390 and 1440 px, including error and receipt states.
- Existing e2e suites pass in both languages or with language-independent selectors.

## Scope boundary

No machine translation of catalog content, no additional languages without an owner decision.

## Release condition

Later; not part of the current UX execution batch.

## Handoff

Write `docs/backlog/implementation/evidence/W26.md` using `evidence-template.md`.
