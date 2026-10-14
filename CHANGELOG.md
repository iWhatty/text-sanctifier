# CHANGELOG — `text-sanctifier`

> Initial cut seeded from `git log` by the host repo's `tools/seed-changelogs.mjs` script. Version groupings infer release boundaries from tags and commit subjects; rough cuts are expected — review and tighten as part of normal maintenance.

## 1.2.0 — 2026-10-14

Minor: new categories, so `inspectText`, `inspectTextDetailed` and `purgeInvisibleChars` report or strip characters they left alone before. No API removals.

- feat: `inspectTextDetailed` reads surrogate pairs, so it sees invisible characters above U+FFFF. `codePoint` is the full code point; `offset` and `column` stay in UTF-16 units (the high surrogate's index)
- feat: new categories, each also detected by `inspectText` (`hasInvisibleChars`) and stripped by `purgeInvisibleChars`:
  - `tag`: U+E0000–U+E007F, tag characters used for "ASCII smuggling" of instructions hidden from humans but read by LLMs
  - `variation_selector`: U+FE00–U+FE0F, U+E0100–U+E01EF. Includes VS16 in emoji (✌️ → ✌ under `purgeInvisibleChars`); `keyboardOnlyEmoji` still keeps it
  - `invisible_format`: U+00AD soft hyphen, U+034F, U+180E, U+2061–U+2064 invisible operators
  - `hangul_filler`: U+115F, U+1160, U+3164, U+FFA0
- `counts` gains `invisible_format`, `hangul_filler`, `variation_selector` and `tag` (added after `c1_control`); `TrashCategory` and the Closure externs list them
- `INVISIBLE_TRASH_REGEX` now has the `u` flag
- build: minified 4923 → 5457 bytes, gzipped 2217 → 2462
- test: the categories == `CONTROL_CHARS_REGEX` ∪ `INVISIBLE_TRASH_REGEX` invariant is checked over all of U+0000–U+10FFFF, not just the BMP; the dist test checks astral findings and the new count fields survive Closure ADVANCED

## 1.1.1 — 2026-10-14

Patch: type declarations only. No runtime changes; the browser build is byte-identical.

- types: `DetailedTrashReport`, `TrashFinding`, `TrashCounts`, `TrashCategory`, `InspectDetailedOptions`, `UnicodeTrashReport` and `SanctifyOptions` are exported from the package root (and `text-sanctifier/browser`), so `import type { DetailedTrashReport } from 'text-sanctifier'` works without `ReturnType<typeof inspectTextDetailed>`
- fix(types): `dist/types/inspectText.d.ts` referenced `SanctifyOptions` without importing it, which broke consumers compiling with `skipLibCheck: false`
- test: `npm run test:types` (in `ci`) compiles a strict TypeScript consumer against `dist/types` through the package `exports` map

## 1.1.0 — 2026-10-14

Minor: adds the `inspectTextDetailed` export. No breaking API changes. `purgeInvisibleChars` and `nukeControls` now also strip the bidi isolates and U+061C, so their output can differ for text containing them.

- fix: bidi isolates U+2066–U+2069 (LRI, RLI, FSI, PDI) and the Arabic letter mark U+061C are detected by `inspectText` and purged by `purgeInvisibleChars` and `nukeControls`; they were missed before (Trojan Source vector)
- feat: `inspectTextDetailed(text, { maxFindings })` locates each invisible or control character as `{ offset, line, column, codePoint, category }` with per-category counts, `total` and `truncated`; categories `bidi_control`, `zero_width`, `nonbreaking_space`, `bom` (with `atStart`), `nul`, `c0_control`, `c1_control`; also in the browser build. `zero_width` also flags U+200D inside emoji ZWJ sequences
- perf: `getNewlineStats` counts in one pass with no regex or copy (16 MB of CRLF: ~81 ms / 64 MB heap → ~25 ms / 0.2 MB)
- build: the Closure export rewrite fails loudly instead of shipping a bundle without exports; minified 3786 → 4923 bytes, gzipped 1701 → 2217

## Unreleased — 2026-03-02

- feat!: add input length guard, improve emoji handling, and generate types  `d76f13a`
- updated pkg size in readme, min + gzip  `198c644`
- chore: normalize README shields row  `7ecc74c`
- chore: rebrand author to WATT3D, interim license  `4300e0b`
- feat: relicense to AGPL-3.0 + WATT3D AI Training Rider  `10a7c99`
- chore: deploy WATT3D AI-bot robots.txt policy  `6df6a09`
- chore: drop DO_NOT_TRAIN_ME, refresh ProjectLayout  `ab319b7`
- chore: revise AI Training Rider (v2 — pre-counsel drafting fixes)  `8f53325`
- chore: rider v3 — remove gameable 0.1% safe harbor  `e018830`
- chore: rider v4 — Commercial Use restricted to Fully Open Source  `771dae3`
- docs(README): apply @whatty README template  `0f12081`
- chore(license): finalize AGPL-3.0 + WATT3D Additional Terms metadata  `e99d436`
- chore: patch version bump to ship license metadata update  `5d7d37b`

## 1.0.17 — 2026-03-02

- cleaned up credit wording and do_not_train file  `623fd71`
- fix(unicode): eliminate global RegExp state bugs and preserve full emoji sequences  `08bb1d0`

## 0.0.16 — 2025-05-28

- Added helper getRecommendedSanctifierOptions.  `7069cf1`
- Enhanced the  EMOJI_REGEX and fallback  `6d8439f`

## 1.0.14 — 2025-05-22

- Added robots.txt  `ae12ad7`
- Bump to version 1.0.11 onNPM.  `09dd7fb`
- Bumped to version 1.0.12 and updated license is now v3.0. Published to NPM  `86c212c`
- Fixed bug where,purgeNonKeyboardChars, would purge newline chars. thus is not desirable since the keyboard can naturally generate newlines via the enter key.  `683d67b`

## 1.0.10 — 2025-05-14

- Added inspectTExt module to simple print a report of the chars found in the text.  `e9d2d88`
- bumped readme to WATT v3.0, and license  `60977da`

## 1.0.8 — 2025-05-08

- Initial Commit, with license, Readme, tests, and npm published  `3441b34`
- package.json updated --> "type": "module"  `f29dfc4`
- Added .strict() and .loose() modes to santifyText to preset default options.  `4f4333d`
- Updated index.d.ta, tohandle the new strict and loose modes.  `c7b1660`
- Imrpoved ReadMe to use the more examples and .strict() and Loose() modes.  `a7ebbcb`
- Added esbuild to test a minfied version.  `530e7b8`
- .ignore files updated to hide build artfacts and temp files.  `56dcf93`
- Added tests for the .min.js code to ensure we bundled and minify'd without breaking anything.  `031a981`
- Added notes to check out Shields.io for badges to finalize the launch.  `ae9aa4a`
- Added Arrow Functions to shorten the sanctifyText functions.  `36afb30`
- Added *.gz to npm ignore.  `4e807bc`
- Bumped to version 1.0.4.  `4610c42`
- testing shields.io in ReadMe  `807049b`
- Updated badges in ReadMe  `0495bb3`
- Added purgeEmojisCharacters, and boolean flag.  `2ba5de0`
- Updated Readme to reflect the purge emoji mode.  `98438e0`
- purgeInvisibleTrash comment improved to match the function logic. We remove these invisible chars, we no longer replace them with a space.  `6616eb0`
- Updated license  `5f6139e`
- feat: add keyboard-only sanitization modes + emoji-safe filtering  `9247412`
- Upadted shield badge targets  `e8ab27d`
- Added Github stars from shields.io  `d8616e5`
