# CHANGELOG — `text-sanctifier`

What changed for people using the package, per release. Entries before 1.1.0 were reconstructed from git history.

## 1.3.12 — 2026-11-05

- Pure ASCII files with many NUL or control bytes are skipped as binary again; valid UTF-8 files containing non-ASCII bytes remain checked.
- `check` and `fix` accept repeatable `--exclude` patterns. JSON reports now include `errors` and `excluded`; JSON usage errors also print JSON to stdout.
- Closed output pipes, as in `check | head -1`, no longer produce an EPIPE stack trace. AI configuration scans with errors and no files now say `Nothing checked.`

Behavior change: `check` skips pure ASCII files with many NUL or control bytes, which 1.3.11 reported, and `--json` usage errors now print JSON to stdout.

## 1.3.11 — 2026-11-04

- `check` no longer reports a clean result when it read nothing. A path or glob that matches no files, or a run that only skipped files, exits 2, and summaries count skipped files.
- `check` with no paths reads piped input, and scans the current directory when stdin is a terminal, the null device or empty; before, empty stdin was read and reported clean.
- Brace globs such as `*.{js,ts}` match inside a git work tree. Before, they matched nothing.
- A stray NUL or bad byte no longer hides a text file from `check` or `reveal`: only files that are not UTF-8 and are mostly control bytes count as binary. UTF-16 files with a BOM are decoded and checked.
- `fix` exits 2 when it refuses stdin or a file you named, and it never rewrites UTF-16. It cleans a named UTF-8 file with a NUL; in a directory or glob it still leaves files with a NUL alone.
- Submodules and symlinks to directories no longer make a directory scan fail, and an input too large to decode no longer ends the run.
- The sanitizer replaces unpaired surrogates with U+FFFD before anything else. Before, removing a character between two halves could join them into a new hidden tag character.
- `onMaxLength: 'truncate'` no longer cuts through a surrogate pair, so the result can be one unit shorter than the cap.
- Trimming spaces around newlines no longer takes quadratic time on long runs of spaces, which could hang `sanctifyLoose`, `sanctifyStrict` and the keyboard presets.
- `getRecommendedSanctifierOptions` no longer recommends `keyboardOnlyFilter` or `purgeEmojis`, which deleted non-English text and emoji. It adds `normalizeSpaces` when it recommends purging, so words don't run together.
- The `text-sanctifier-ai-config` pre-commit hook no longer limits itself to files pre-commit considers text, so control bytes can't hide a configuration file from it.

Behavior change: `check` with no paths and empty stdin now scans the current directory instead of reporting stdin clean, `check` and `fix` can exit 2 where they exited 0, `check` can exit 1 on files it skipped as binary, the sanitizer changes unpaired surrogates even with no flags set, and `getRecommendedSanctifierOptions` returns different flags.

## 1.3.10 — 2026-11-04

- `fix --keep-benign` preserves recognized legitimate joiners, selectors and flag tags while purging other invisible characters.
- Behavior change: `findHiddenRuns` and `decodeTagText` throw `TypeError` for non-string input.
- `check --ai-config` bounds stored findings and decoded tag text when a finding limit is set, while retaining exact counts.
- SARIF results include stable partial fingerprints for code-scanning tools.

## 1.3.9 — 2026-11-03

- `findHiddenRuns` and `check --ai-config` treat a lone U+FE0E or U+FE0F as benign only after an emoji or in a keycap, as `text-sanctifier/context` does. Before, any non-space character counted, so a selector after each letter could carry hidden data unreported.
- `check` and `reveal` read files that are not valid UTF-8 instead of skipping them, with each invalid byte as U+FFFD, so one bad byte no longer hides the rest of a file. They are noted on stderr and listed under `notUtf8` in `--json`. `fix` still never writes them.
- Stdin and AI configuration files are never skipped as binary; a NUL in them is reported as `nul`.
- `check --ai-config` with no paths still searches the current directory when input is piped, and now says to pass `-` to check stdin.

Behavior change: `check` can now exit 1 on files it used to skip, and `findHiddenRuns` reports selectors after letters that it used to list under `benign`.

## 1.3.8 — 2026-11-02

- `inspectTextInContext` now treats a ZWNJ or ZWJ after a virama (Hindi, Bengali and other Indic scripts) and a ZWNJ between Arabic-script letters (Persian and others) as benign, following IDNA ContextJ (RFC 5892).
- `inspectTextInContext` returns `benignSupplementarySelectorCount`, so you can subtract it from `findHiddenRuns(text).supplementarySelectorCount` to get the suspicious ones.

Behavior change: those joiners were reported `benign: false` before.

## 1.3.7 — 2026-11-01

- New entry point `text-sanctifier/context`: `inspectTextInContext(text, options)` returns the same report as `inspectTextDetailed`, plus `benign` on each finding and exact `benignCounts`. Benign means part of a legitimate sequence: emoji ZWJ sequences, emoji and keycap presentation selectors, ideographic variation sequences, Mongolian selectors after a Mongolian letter, and the England, Scotland and Wales flags. Zero-width spaces, word joiners, BOMs and bidi controls are never benign.
- `findHiddenRuns` returns `codePointCounts` and `supplementarySelectorCount`.

## 1.3.6 — 2026-11-01

- Each preset is its own export: `sanctifyStrict`, `sanctifyLoose`, `sanctifyKeyboardOnly`, `sanctifyKeyboardOnlyEmoji` and `sanctifyPasted`. Importing one bundles smaller than importing `summonSanctifier`.
- `VERSION` export, from the package root and `text-sanctifier/hidden`.
- `findHiddenRuns(text, { maxRuns, maxDecodedLength })` caps what it lists while keeping `counts`, `total` and `benignTotal` exact, so memory stays flat on huge inputs. Each run now has `line` and `column`.
- `inspectText` no longer pulls in the sanitizer when bundled.

Behavior change: `findHiddenRuns` and `check --ai-config` report the reserved tag-plane code points (U+E0080–U+E00FF, U+E01F0–U+E0FFF) as a new run kind, `reserved_tag_plane`. A TypeScript `switch` over `HiddenRunKind` needs the new case.

## 1.3.5 — 2026-11-01

- `revealInvisible(text, { format })` replaces hidden characters with visible markers such as `<U+200B>` and keeps everything else.
- `summonSanctifier.pasted`, a preset for pasted text and model output: look-alike spaces become ordinary spaces, zero-width spaces are removed, and newlines are normalized. Emoji, ZWNJ, bidi marks, indentation and blank lines are kept.
- New `SanctifyOptions`: `normalizeSpaces` and `purgeZeroWidthSpaces`.
- New command `text-sanctifier reveal [paths...]`, and `fix --normalize-spaces`.
- Fix: in `text-sanctifier/browser`, `onMaxLength` was ignored, so `truncate` and `noop` behaved like `throw`.
- With a bundler, import `text-sanctifier`; `text-sanctifier/browser` is for pages with no build step.

Behavior change: `text-sanctifier fix` with no cleaning flag now replaces look-alike spaces with ordinary spaces instead of deleting them, so words next to a non-breaking space no longer run together.

## 1.3.4 — 2026-11-01

Docs only: corrected CHANGELOG headings for 1.0.16–1.0.20, and README badges that load on GitHub and npm.

## 1.3.3 — 2026-10-29

- New entry point `text-sanctifier/hidden`: `findHiddenRuns` and `decodeTagText`, the scanner behind `check --ai-config`. It has no Node APIs, so it runs in browsers too.

## 1.3.2 — 2026-10-15

- `check --format sarif` prints a SARIF 2.1.0 log for code-scanning tools.
- `check --ai-config [paths]` finds agent instruction files (`CLAUDE.md`, `AGENTS.md`, `SKILL.md`, Cursor and Copilot rules, MCP config and others) and reports hidden tag text, decoded, plus variation-selector and invisible-operator runs.
- Two pre-commit hooks: `text-sanctifier` and `text-sanctifier-ai-config`.
- Fix: `inspectTextDetailed` finds invisible characters in every plane, not only plane 14.

Behavior change: every Unicode Default_Ignorable_Code_Point is now categorized (about 3,700 were missing, mostly reserved plane-14 code points), so `inspectText`, `inspectTextDetailed` and `purgeInvisibleChars` report or strip characters they left alone before, including the Mongolian free variation selectors.

## 1.3.1 — 2026-10-14

- `getNewlineStats` is exported, with a `NewlineStats` type.
- Fix: U+205F (medium mathematical space) is detected and stripped as `nonbreaking_space`.
- `maxFindings: 0` gives exact counts without building finding objects.

## 1.3.0 — 2026-10-14

- New `text-sanctifier` command. `check [paths...]` lists each hidden character with its line and column and exits 1 when it finds any. `fix [paths...]` removes them, with `--dry-run` and `--json`. Directories respect `.gitignore`; binary and non-UTF-8 files are skipped.

## 1.2.0 — 2026-10-14

- `inspectTextDetailed` sees characters above U+FFFF.
- New categories: `tag` (tag characters used to hide instructions from humans but not from LLMs), `variation_selector`, `invisible_format` and `hangul_filler`.

Behavior change: `inspectText`, `inspectTextDetailed` and `purgeInvisibleChars` report or strip those characters now, including VS16 in emoji. `keyboardOnlyEmoji` still keeps VS16.

## 1.1.1 — 2026-10-14

- The report and option types are exported from the package root, so `import type { DetailedTrashReport } from 'text-sanctifier'` works.
- Fix: the type declarations compile with `skipLibCheck: false`.

## 1.1.0 — 2026-10-14

- `inspectTextDetailed(text, { maxFindings })` locates each invisible or control character with its offset, line, column, code point and category.
- `getNewlineStats` is faster and uses almost no memory.

Behavior change: bidi isolates (U+2066–U+2069) and U+061C are now detected and stripped by `purgeInvisibleChars` and `nukeControls` (Trojan Source).

## 1.0.20 — 2026-05-26

- Requires Node 18 or later.
- Types for the `./browser` export.

## 1.0.19 — 2026-05-20

- Relicensed to AGPL-3.0 with WATT3D Additional Terms.

## 1.0.18 — 2026-03-02

- Input length guard (`maxLength`, `onMaxLength`), better emoji handling, and generated type declarations.

## 1.0.17 — 2026-03-02

- Fix: regexes no longer keep global state between calls, and full emoji sequences are preserved.

## 1.0.16 — 2025-05-28

- `getRecommendedSanctifierOptions` helper; better emoji matching.

## 1.0.14 — 2025-05-22

- Fix: the keyboard-only filter no longer removes newlines.

## 1.0.10 — 2025-05-14

- `inspectText`, a report of the hidden characters in a string.

## 1.0.8 — 2025-05-08

- First release: `summonSanctifier` with `strict` and `loose` presets, keyboard-only filtering and emoji purging.
