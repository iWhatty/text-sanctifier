# CHANGELOG — `text-sanctifier`

> Initial cut seeded from `git log` by the host repo's `tools/seed-changelogs.mjs` script. Version groupings infer release boundaries from tags and commit subjects; rough cuts are expected — review and tighten as part of normal maintenance.

## Unreleased

Same category names. `invisible_format` and `variation_selector` now cover every remaining Default_Ignorable_Code_Point, so `inspectText`, `inspectTextDetailed` and `purgeInvisibleChars` report or strip characters they left alone before.

- feat(cli): `check --format sarif` prints a SARIF 2.1.0 log: one result per finding with file, line, column (UTF-16 units) and the category as `ruleId`. Levels: `error` for `bidi_control` and `tag`, `note` for `nonbreaking_space`, `warning` for the rest. The levels live in the command line only; categories are unchanged. `--format json` is the same as `--json`, which still works
- feat(cli): `check --ai-config [paths]` searches for agent instruction files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `SKILL.md`, `.claude/`, Cursor, Windsurf, Cline and Roo rules, Copilot instructions and prompts, MCP config JSON) and reports runs of tag characters, variation selectors and invisible operators once each, decoding the ASCII hidden in tag runs. The England, Scotland and Wales flags and a single emoji or text presentation selector are left out; a plain `check` still reports them. `--json` adds `hiddenRuns` and `hiddenRunCount`
- feat: `.pre-commit-hooks.yaml` publishes two pre-commit hooks, `text-sanctifier` (`check` on staged text files) and `text-sanctifier-ai-config` (`check --ai-config` on staged agent instruction files). They run locally
- The new code is in `bin/` and `src/hiddenText.js`, which `src/index.js` does not import, so the browser bundle is unchanged
- test: `tests/cli.test.js` checks the SARIF log against the fields SARIF 2.1.0 requires (offline), the `--ai-config` file list against the pre-commit hook's `files` pattern, tag decoding, and that the flags are not reported
- fix: every Default_Ignorable_Code_Point is now categorized; about 3,700 were missing, mostly reserved plane-14 code points
  - `variation_selector` gains the Mongolian free variation selectors U+180B–U+180D and U+180F. They are the same smuggling vector as the other variation selectors, but legitimate in Mongolian text, which `purgeInvisibleChars` can change
  - `invisible_format` gains U+17B4–U+17B5 (Khmer inherent vowels), U+2065, U+206A–U+206F (deprecated format characters), U+FFF0–U+FFF8, U+1BCA0–U+1BCA3 (shorthand format controls), U+1D173–U+1D17A (musical formatting), and the reserved plane-14 ranges U+E0080–U+E00FF and U+E01F0–U+E0FFF. Those sit next to the tag block, so before this a check that only covered U+E0000–U+E007F could be bypassed
- fix: `inspectTextDetailed` decodes every surrogate pair, not just those starting with U+DB40, so invisible characters in any plane are found. Lone surrogates are still skipped. Emoji-heavy text scans faster (4 M characters: 20.1 → 14.3 ms); other text is unchanged
- build: `npm run build` (and so `npm run ci`) fails when the gzipped browser bundle exceeds `GZIP_BUDGET_BYTES` (3072 bytes) in `scripts/buildc.js`; it is 2632 today
- docs: DESIGN.md has a survey of similar tools and the problems seen in practice, and a roadmap with status
- test: a drift guard checks that every Default_Ignorable_Code_Point in the running Node's Unicode data (4,174 code points in Unicode 16.0) is categorized, so a Node upgrade that brings newer Unicode data fails until `scripts/categories.js` catches up; the dist test covers the new planes
- build: the generator no longer requires astral ranges to share one high surrogate, and `TRASH_HIGH_SURROGATE` is gone from `src/categories.generated.js` (it was never exported from the package)
- refactor: the categories and their code points are defined once, in `scripts/categories.js`. `npm run gen` generates `CONTROL_CHARS_REGEX`, `INVISIBLE_TRASH_REGEX` and the `inspectTextDetailed` classifier (`src/categories.generated.js`), plus the category list in its JSDoc and the README table; `npm run ci` fails while any of them is stale. Checked against the previous regexes and classifier over every code point U+0000–U+10FFFF
- perf: the classifier is a generated binary search on numbers, split in two so V8 inlines it. On 4 M characters: CJK 19.6 → 13.3 ms, emoji 12.7 → 9.3 ms, Latin-1 unchanged, NBSP 17.0 → 18.6 ms (16 MB of NBSP: about 70 → 80 ms; README updated)
- docs: the README category table has a "Removed by" column, and `c0_control` lists its ranges explicitly
- build: minified 5542 → 5724 bytes (category table) → 6045 (new ranges), gzipped 2495 → 2531 → 2632

## 1.3.1 — 2026-10-14

Patch: feedback from a downstream consumer after integrating 1.3.0. No API removals.

- feat: `getNewlineStats` is exported from the package root and the browser build, with a `NewlineStats` type (`{ crlf, cr, lf, types, mixed }`); it was already used inside `inspectText` but could only be reached through `src/inspectText.js`
- fix: U+205F (medium mathematical space) is in `nonbreaking_space`, alongside U+2000–U+200A and U+202F; `inspectText` now flags it and `purgeInvisibleChars` now strips it
- docs: the cost of `maxFindings` grows with the number of findings, not the input size (roughly 100–200 bytes per listed finding, so `Infinity` on 8 M findings is about 1.5 GB); `maxFindings: 0` is a counts-only mode that builds no finding objects
- test: `maxFindings: 0` on 16 MB of NBSP (16.7 M findings) keeps exact counts and leaves the heap flat; the dist test checks that `getNewlineStats` and its fields survive Closure ADVANCED; the TypeScript consumer imports `getNewlineStats` and `NewlineStats`
- build: minified 5457 → 5542 bytes, gzipped 2462 → 2495

## 1.3.0 — 2026-10-14

Minor: adds a `text-sanctifier` command. The library API is unchanged.

- feat: `text-sanctifier check [paths...]` prints `path:line:column  U+XXXX  category` for each finding from `inspectTextDetailed`, or `--json`; `--max-findings N`; exits 1 when anything is found, so CI and coding agents can run it without writing scripts
- feat: `text-sanctifier fix [paths...]` rewrites files with `--purge-invisible`, `--nuke-controls`, `--normalize-newlines` (default: the first two), `--dry-run` (exits 1 when changes are pending) and `--json`, and reports what it removed per category
- paths may be files, directories or globs; inside a git work tree, directories and globs skip whatever `.gitignore` excludes (via `git ls-files`); binary and non-UTF-8 files are skipped and never written; `-` or piped input reads stdin
- a BOM at offset 0 is kept by `fix` and not reported by `check` unless `--strip-bom` is given
- plain Node 18+, no dependencies; exit code 2 for usage errors, missing paths and unreadable files
- test: `tests/cli.test.js` runs the command against temp directories, including a throwaway git repo for `.gitignore`

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
