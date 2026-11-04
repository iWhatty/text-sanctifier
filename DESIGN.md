# Design notes: `text-sanctifier`

Why this library exists, who it serves, and the rules that keep it trustworthy. Read this before adding a feature, a category or a build target.

## What it is

Text is the shared material of language, code, configuration and model prompts. Invisible and control characters slip into it all the time: a script emits the wrong code point, a paste carries a non-breaking space, a bidi control reorders what a reviewer sees, tag characters hide instructions that a person can't see but a language model reads. Usually it isn't an attack, just a stray character that shouldn't be committed. Sometimes it is an attack.

`text-sanctifier` does two jobs:

1. **Inspect**: find these characters and report exactly where they are.
2. **Sanctify**: remove or normalize them, with presets and fine-grained flags.

It is not an HTML/XSS sanitizer and not a full security scanner. For those jobs, use or combine dedicated tools.

## Two audiences

The same source serves two kinds of consumer, with different constraints.

| | **Web** (websites, browser extensions) | **Node and agents** (coding agents, CI, developer tooling) |
| --- | --- | --- |
| Main job | Clean user input; security hygiene | Stop invisible "slop" being committed; give agents exact locations they can't see for themselves |
| Entry point | `text-sanctifier/browser` (minified ESM bundle) | `text-sanctifier` (ESM source) and the `text-sanctifier` command |
| Constraint | Bundle size: every byte ships to every user | Capability: structured output, clear errors, predictable behavior |
| Budget | Keep the gzipped bundle small, no dependencies | Size matters less than correctness and clarity |

When the two pull apart, split the entry points rather than compromise both. Node-only features (file walking, the command-line tool, heavier analysis) belong in the Node entry point or the command-line tool, never in the browser bundle. A dedicated Node entry point with a larger feature set is an acceptable future direction. The browser bundle should keep only what a page or an extension needs.

Code-aware judgement belongs downstream, not here. Whether a zero-width space sits in an identifier, a string literal or a comment needs a syntax tree. This library reports characters and positions; tools that understand the language decide what a finding means.

## Why agents are a first-class audience

Agents (and the people reviewing their work) can't see these characters. A zero-width space or a bidi isolate shows up in tool output as nothing at all. Without a tool, each agent writes its own one-off script, which costs tokens and time and is often subtly wrong. A shared, tested tool:

- lets smaller, faster models do tasks they couldn't script themselves, and
- saves larger models from spending effort on housekeeping that should already be automated.

So the agent-facing surface is held to these rules:

- **Exact and structured.** Offsets, lines, columns, code points, categories. JSON on request. Exit codes that mean something: 0 clean, 1 findings or pending changes, 2 usage or I/O error.
- **Bounded output.** `maxFindings` protects both memory and the reader's context window. Counts stay exact even when the list is capped. `maxFindings: 0` is a counts-only mode.
- **Documented well enough to use without reading the source.** If a consumer has to read `src/` to integrate, the docs are incomplete.
- **Safe defaults.** A model that runs a command with no flags should not lose meaning. A transformation that destroys information, such as splitting emoji sequences, should be opt-in or clearly documented.

## Invariants

These are tested. Keep them true.

- **What inspection reports equals what purging removes.** The categories in `inspectTextDetailed` cover exactly `CONTROL_CHARS_REGEX` ∪ `INVISIBLE_TRASH_REGEX`, checked over every code point U+0000–U+10FFFF.
- **Nothing a renderer hides goes unreported.** Every Default_Ignorable_Code_Point in the running Node's Unicode data is in a category.
- **Every import stays within its size budget.** `scripts/check-size.js` bundles each export on its own, tree-shaken and minified, and checks its gzipped size; detection-only imports must not contain the sanitizer or the emoji tables, and `inspectText`, which reports emoji, must not contain the sanitizer. The prebuilt browser file has its own budget (`GZIP_BUDGET_BYTES` in `scripts/browser-build.js`).
- **One pass, no copies** for inspection and newline counting; performance claims in the docs are measured.
- **Zero runtime dependencies.**
- **Public field names survive the minifier.** The browser file is built with esbuild, which does not rename properties; the dist tests check every public field.
- **Types match the runtime.** A strict TypeScript consumer compiles against `dist/types` through the package `exports` map.

## Categories are API

Consumers switch on category names and read every key of `counts`.

- Adding code points to an existing category is a normal change: note it in the CHANGELOG, because what gets reported and stripped changes.
- Adding a category, or renaming or splitting one, breaks any consumer that handles every category. Plan these deliberately, batch them, and say so prominently in the CHANGELOG.

Known open questions:

- Separating the emoji joiner (U+200D in ZWJ sequences) from standalone zero-width characters.
- Separating benign emoji variation selectors (U+FE00–FE0F) from the supplementary ones (U+E0100–E01EF), which can carry hidden data.
- `nonbreaking_space` also holds U+2000–U+200A, most of which are breaking spaces, so the name misleads.

## Where this sits among similar tools

A survey of overlapping open-source tools in October 2026 found many that detect invisible characters and few that fix them:

- **Detectors** such as anti-trojan-source (npm) and heckler (PyPI) report findings and integrate well (JSON or SARIF output, pre-commit hooks), but they don't remove anything.
- **Linter rules** (ESLint's `no-irregular-whitespace`, eslint-plugin-security, rustc and Clippy lints, Go's bidichk) reach many projects but each covers a narrow set of characters.
- **Fixers** such as out-of-character remove characters but report only an offset.
- **LLM input filters** that stripped hidden text before it reached a model are largely archived, which leaves that job under-served.

This library's place is doing both jobs in one tool: findings with exact positions and typed categories, plus presets that fix, in a small browser build and a command-line tool. Other tools are ahead on integration (SARIF, pre-commit hooks, editor plugins), on metadata per finding (severity, Unicode character names, the decoded text hidden in tag characters), and on context (leaving legitimate emoji and script sequences alone). The roadmap below closes those gaps without giving up the small core.

The problems seen in practice, which this library should keep solving:

- **Model output** that carries narrow non-breaking spaces and other look-alike spaces into code, Markdown and data. The right fix is to replace them with an ordinary space, not delete them.
- **Coding agents** whose edits fail on characters they can't see in their own tool output.
- **Hidden instructions** in rules files, agent skill files, tool descriptions and web content, using tag characters, variation selectors and invisible operators.
- **Everyday data hygiene:** a BOM glued to the first CSV header, U+2028/U+2029 breaking JavaScript and JSON, mixed line endings.

## Roadmap: two tracks, one core

The goal is for the web and server tracks to move forward together without drifting apart. Shared work goes in the core; each track grows only in its own entry point. Status as of release <!-- gen:release -->1.3.11 (2026-11-04)<!-- /gen -->.

### Shared core (both tracks)

- **Done: one table of categories and code-point ranges, used everywhere.** `scripts/categories.js` is the table, and `npm run gen` generates the purge regexes and the classifier (`src/categories.generated.js`), the category list in the `inspectTextDetailed` JSDoc and the README table. `npm run ci` fails while any of them is stale. They are generated rather than built at module load, so the browser bundle ships no table or builder and the classifier stays plain number comparisons.
- **Done: complete coverage of Default_Ignorable_Code_Point**, the Unicode property for characters renderers must draw as nothing. A test checks it against the running Node's Unicode data, so a Node upgrade with newer Unicode fails until the table catches up.
- **Next: one planned set of category changes** for both tracks. It covers the open questions above (the `nonbreaking_space` name; the emoji joiner and the two kinds of variation selector are now answered without a category change, by `text-sanctifier/context` and the `findHiddenRuns` totals) and characters that are not invisible but still cause trouble: U+2028/U+2029 line and paragraph separators, unpaired surrogates (the sanitizer already replaces them with U+FFFD, so they can't join into a hidden character, but inspection doesn't report them yet), noncharacters (to be reported or replaced with U+FFFD, never deleted), U+FFFD itself as a sign of a decoding error, and blank-looking characters such as U+1680 and U+2800.
- **Done: a reveal helper.** `revealInvisible` and `text-sanctifier reveal` render hidden characters visibly as `<U+XXXX>` markers, as Unicode's source-code guidance (UTS #55) recommends, for logs, diffs and agent tool output. Unicode character names in markers would need a name table, so they belong in the server track.
- **One test corpus run against both builds**, so the source build and the browser build can never report differently.

### Server track (Node, agents, CI)

Capability over size.

- **A dedicated server entry point** (for example `text-sanctifier/server`) for features that don't belong in the browser bundle.
- **Done: a check for AI configuration files.** `text-sanctifier check --ai-config` searches for rules files, agent skill files, `CLAUDE.md`/`AGENTS.md` and MCP configuration, reports runs of tag characters, variation selectors and invisible operators, and decodes the ASCII hidden in tag runs. The England, Scotland and Wales flags and a lone presentation selector after an emoji or in a keycap are left out (after a letter, one selector per letter can carry a bit, so it is reported). Files that are not valid UTF-8 are checked with U+FFFD for invalid bytes, and AI configuration files are never skipped as binary, so neither can hide a file from the check. Still open: tool descriptions served by a running MCP server, and decoding data hidden in variation selectors.
- **Done: integration that runs locally.** `check --format sarif` (SARIF 2.1.0, a level per category, set in the command line) and `.pre-commit-hooks.yaml` with two hooks. No cloud CI.
- **Findings an agent can act on directly:** a severity and the Unicode character name on each finding, and a versioned JSON schema for reports from the library and the command-line tool.
- **Context-aware findings**, to tell legitimate emoji joiners, colour selectors and flag sequences (and joiners in scripts that need them) from hidden ones. Built: see "Context-aware findings" below.
- **A bidi balance check** for unterminated or overlapping bidi controls, the specific Trojan Source pattern.
- **`fix` options and reports:** rewrite characters in source as escape sequences instead of deleting them, list each removal by its offset in the original text, and allow suppressions by code point or path.
- **Streaming inspection** for very large files.

### Web track (websites, browser extensions)

Size over features.

- **Done: gzipped size budgets enforced by `npm run ci`, per import.** Bundler users pay only for what they import, so each export has its own budget in `scripts/check-size.js`, plus leak checks. The prebuilt browser file, for pages with no build step, keeps a <!-- gen:budget:browser -->3 KiB<!-- /gen --> gzipped budget (`GZIP_BUDGET_BYTES` in `scripts/browser-build.js`). Raising a budget is a deliberate decision made in the same commit as the growth. Current sizes are in "Sizes now" below; `npm run gen` writes them, and `npm run ci` fails while they are stale.
- **Done: a preset for model output and pasted text.** `summonSanctifier.pasted` turns look-alike spaces into ordinary spaces and removes zero-width spaces, while keeping emoji joiners, selectors and bidi marks. `fix` now does the same with spaces by default and reports replacements apart from removals. Still open: optional quote and dash folding.
- **Presets for cleaning form input.**
- **Done: per-import size budgets.** Bundlers import the ESM source and keep only what is used, so size is checked per export (`scripts/check-size.js`) rather than only for the prebuilt file.
- **Done: `inspectText` no longer pulls in the sanitizer.** The patterns it shares with the sanitizer (the emoji regex, the keyboard-safe regex and the typographic normalizer) live in `src/textPatterns.js`, and the emoji regex is built by a function marked pure instead of in a top-level `try`. `inspectText` went from 1882 to 1106 bytes gzipped, and its size probe now fails if the sanitizer leaks back in.
- **Done: standalone preset exports.** Each preset is its own export (`sanctifyStrict`, `sanctifyLoose`, `sanctifyKeyboardOnly`, `sanctifyKeyboardOnlyEmoji`, `sanctifyPasted`), and `summonSanctifier` attaches the same functions in an `Object.assign` call marked pure instead of top-level property assignments. Importing one preset is about <!-- gen:size:sanctifyPasted -->1.1 KiB<!-- /gen --> gzipped instead of <!-- gen:size:summonSanctifier.pasted -->1.5 KiB<!-- /gen -->. The new names cost 40 bytes on `summonSanctifier` and 73 on the prebuilt browser file. With little headroom left in the browser file's budget (see "Sizes now"), the next addition to it needs a decision about its budget or what it includes.
- **Done: bounded hidden-run scans.** `findHiddenRuns` takes `maxRuns` and `maxDecodedLength`, keeps `counts`, `total` and `benignTotal` exact, and gives each run `line` and `column` counted as `inspectTextDetailed` counts them, so callers no longer need their own scan limit or position code. The reserved code points of the tag plane (U+E0080–U+E00FF, U+E01F0–U+E0FFF) are a run kind of their own, `reserved_tag_plane`, so hidden-text scans cover the whole block up to U+E0FFF without a new category. With both caps set, 16 M characters (32 MB) of hidden text grow the heap by under 1 MB. `VERSION` is exported (generated from `package.json`), costing 19 bytes in the browser file. Still open: `check --ai-config` takes run positions from an uncapped `inspectTextDetailed` call and could use the run fields instead.

### Sizes now

Gzipped bytes per import in the source on `main`, written by `npm run gen` (the last release is <!-- gen:release -->1.3.11 (2026-11-04)<!-- /gen -->):

<!-- gen:sizes:start (generated by `npm run gen`; do not edit) -->
| Import | Gzipped bytes | Budget | Headroom |
| --- | ---: | ---: | ---: |
| `inspectTextDetailed` | 959 | 1100 | 141 |
| `revealInvisible` | 1104 | 1250 | 146 |
| `getNewlineStats` | 272 | 350 | 78 |
| `getRecommendedSanctifierOptions` | 175 | 250 | 75 |
| `inspectText` | 1106 | 1250 | 144 |
| `summonSanctifier` | 1493 | 1600 | 107 |
| `summonSanctifier.pasted` | 1493 | 1600 | 107 |
| `sanctifyPasted` | 1152 | 1250 | 98 |
| `sanctifyStrict` | 1146 | 1250 | 104 |
| `text-sanctifier/hidden` | 1196 | 1250 | 54 |
| `text-sanctifier/context` | 2074 | 2250 | 176 |
| `VERSION` | 51 | 60 | 9 |
| `everything` | 3059 | 3072 | 13 |
| prebuilt browser file | 3059 | 3072 | 13 |
<!-- gen:sizes:end -->

### Not planned here

- **Confusable and homoglyph detection** (UTS #39 skeletons, mixed-script checks) needs large data tables and belongs in a separate layer or tool.
- **Deciding what a finding means in code** (identifier, string or comment) needs a syntax tree and belongs in tools that parse the language.
- **Running checks in cloud CI by default.** Checks run locally.

### Order

1. Done: the single category table, full default-ignorable coverage, and the size budget.
2. Done: the AI configuration file check, SARIF output and the pre-commit hook. These came first because the risk is current and the work is small.
3. The planned category changes, coordinated with consumers and shipped together.
4. Done: context-aware findings (1.3.7, script joiners in 1.3.8), the reveal helper and the pasted-text preset.
5. The server entry point, once the first server-only feature needs a home.

## Context-aware findings

Status: released in 1.3.7; script joiners and `benignSupplementarySelectorCount` in 1.3.8. The names below are API.

**Problem.** `zero_width` counts U+200D inside emoji such as a family emoji, and `variation_selector` counts VS16 in emoji and the ideographic selectors (U+E0100–U+E01EF) in CJK names. A consumer that warns from `counts` can't tell those from a joiner or selector used to hide text. The listed findings carry the code point, which separates U+200D from U+200B, but not whether a U+200D sits inside an emoji.

**Not a category split.** New categories would add `counts` keys and change `TrashCategory`, a breaking change for every consumer that reads `counts`. The categories stay as they are; context is reported next to them.

**Shape.** A separate entry point, `text-sanctifier/context`, so the core and the browser file don't pay for the Unicode property tables:

```js
import { inspectTextInContext } from 'text-sanctifier/context';

const report = inspectTextInContext(text, { maxFindings: 20 });
// everything inspectTextDetailed returns: findings, counts, total, truncated
// plus benignCounts: the same keys as counts, exact whether or not a finding is listed
// and benign: true on each listed finding that is part of a legitimate sequence
```

`counts` is unchanged, so `counts[c] - benignCounts[c]` is the number of suspicious characters in category `c`. Exact benign counts are the point: a consumer that warns from counts beyond the listed findings can't use a flag on listed findings alone.

**Rules.** The [README context section](README.md#text-sanctifiercontext-inspecttextincontexttext-options) defines the benign sequences and the script-joiner approximation. Keep those rules there.

**Implementation.** The same single pass as `inspectTextDetailed`, checking only the neighbours of each finding with sticky regexes (`/\p{Extended_Pictographic}/yu` at an index), so nothing is allocated per character and memory stays flat with `maxFindings` set. Neighbour checks match the rules above exactly and need no `Intl.Segmenter`; full grapheme segmentation would allocate per cluster and decide nothing these rules don't. It needs Unicode property escapes in regexes (ES2018: Node 10+, every current browser).

**Script-joiner implementation.** JavaScript regexes have no property for combining classes, so `scripts/gen-virama.js` derives the <!-- gen:count:viramas -->69<!-- /gen --> viramas from Node's normalization data (canonical reordering puts a class 9 mark after class 8 and before class 10) and writes `src/virama.generated.js`. `npm run gen:check` fails when Node's Unicode data changes the set. Joining_Type is also unavailable as a regex property; shipping ArabicShaping.txt would cost bytes and could not be checked against Node. The approximation and its limits are documented in the README rules linked above.

**Supplementary selectors, exactly.** `benignSupplementarySelectorCount` counts the benign U+E0100–U+E01EF, part of `benignCounts.variation_selector`. `findHiddenRuns(text).supplementarySelectorCount` counts every one of them (it never marks them benign), so the difference is the exact number of suspicious ones, which `benignCounts.variation_selector` alone can't give because it also counts emoji selectors.

**Related ask: code-point totals per run kind.** `findHiddenRuns` counts runs, not their length. A `codePointCounts` field with the same keys as `counts` (total code points per kind) gives exact totals beyond the listed runs, and a `supplementarySelectorCount` (U+E0100–U+E01EF, counted apart from U+FE00–U+FE0F) separates the selectors that can carry data from emoji selectors. Additive; built as proposed.

**Size and tests.** Its own size probe and budget; core probes unchanged. Tests: every rule with positive and negative cases, `benignCounts` equal to the benign listed findings when nothing is truncated, `benignCounts[c] <= counts[c]`, and the 16 M-unit heap check.

**Known limits.** Each errs in one known direction, and none has been reported as a problem in real text:
- The Arabic-script ZWNJ rule is approximate (see "Script-joiner implementation"): it accepts a ZWNJ after letters that don't join to the left, such as alef, reh and waw, so a few suspicious characters read as benign.
- Joiners in the other joining scripts (Syriac, N'Ko, Mongolian, Adlam, Hanifi Rohingya and others) are never benign, so legitimate ones read as suspicious.
- `Extended_Pictographic` includes text-default symbols such as © and ® and unassigned code points in the emoji ranges, so a joiner or selector next to one reads as benign. `Ideographic` includes U+3006, U+3007, U+3021–U+3029 and Tangut, so a supplementary selector after one reads as benign.
- Speed: memory stays flat, but every joiner costs a few sticky-regex tests. On 16 M UTF-16 units with `maxFindings: 20` (Node 24, `npm run bench`): clean text 62 ms, 5.6 M virama joiners 0.5 s, 8 M Arabic-script ZWNJ 1.6 s.

**Next, when reports call for it.** No consumer has open asks, so the next round waits for false warnings or misses seen in real text. What each kind of report would lead to:
- False warnings on Syriac, N'Ko or other joining scripts: an exact Joining_Type table generated from Unicode's ArabicShaping.txt, replacing the Arabic-script approximation. Costs bytes in this entry point and a data file at generation time that Node can't check.
- Misses next to © or ®: limit the emoji rules to code points with emoji presentation, or a VS16 before the joiner.
- Slow scans on large Persian or Indic input: test cheap code-unit ranges (the Arabic blocks, the virama table's BMP part) before the property regexes.
- A selector that carries data after a legitimate base: decoding data hidden in variation selectors, already listed under the server track.

## Releases

- Bump the patch number only, even for new exports or behavior changes. Batch work done close together into one release. Changing the minor or major number is a deliberate decision. See `PublishChecklist.txt`.
- Describe behavior changes in `CHANGELOG.md` instead of signalling them through the version number.
- Tag releases `vX.Y.Z` on the commit that was published.
- The steps are scripted in `scripts/release.js`: `npm run release:prep` (run `npm run ci` before changing the version, bump, date the `## Unreleased` CHANGELOG section, `npm run gen`, run ci again to rebuild the browser file with the new VERSION, commit, push), then the maintainer's `npm publish`, then `npm run release:verify` (wait for npm, check gitHead, shasum and file count against the commit, tag and push the tag). `.gitattributes` keeps every checkout LF, so the shasum is the same from any clone.
- Prep, including `--dry-run`, requires a nonempty local private-names file and `core.hooksPath` set to `scripts/hooks` (`npm run hooks:install`). Dry runs change nothing and do not run ci. A failure after the bump reports the step, `git status --short`, whether a commit was made and the exact local undo command; nothing is undone automatically. Check origin after a push failure before retrying.
- `prepublishOnly` guards `npm publish`: main must be clean and equal origin/main after a successful fetch, the package version must have a dated CHANGELOG heading and must not already be on npm. Network lookup failures stop publishing. The guard then rebuilds the browser file and generated declarations. Verification still uses `npm pack --ignore-scripts`, which bypasses this guard. npm's gitHead must be exactly 40 hexadecimal characters before use in git commands.
- Figures that change with every release or every size change (gzipped sizes and budgets, the virama count, the current release, the README's pre-commit `rev:` and size badge) are written by `npm run gen` between `gen:` markers, HTML comments that don't render (`scripts/gen-docs.js` lists them), and `npm run ci` fails while they are stale. Every opening marker must be handled: malformed markers, split values and missing closers fail with exit 2 and a line number. Missing README rev or size-badge anchors also fail. Speed figures depend on the machine, so they stay out of ci: `npm run bench` measures them, and the docs are updated by hand when they move.
- `npm run release:verify -- --github-release` also creates the GitHub release, with that version's CHANGELOG section as its notes.
- This repo is public, so names of private projects that use it must not appear in it. They are listed in `.git/info/private-names`, which is never committed; `npm run ci` checks working files, paths, staged additions, unpushed messages and every unpushed commit's added lines, including content removed by later commits. `npm run hooks:install` adds a pre-push hook that checks the pushed ranges too; if a remote object is missing locally it checks the local tip excluding all remote refs. Plain list entries match whole words, ignoring case; entries starting with `*` match substrings. Spaces in names also match line breaks. Missing or empty lists skip ordinary checks; release prep requires the file to exist and contain bytes.
- Publishing needs the maintainer's npm two-factor credentials. Agents prepare and verify releases; a maintainer publishes.

## Working in this repo

- `npm run ci` runs the generated-file check, the tests, both builds, the type check and the dist tests. Run it before every commit.
- CI here means the local `npm run ci` script. The repo deliberately has no cloud CI (GitHub Actions or similar), so checks cost nothing to run. Add new checks to the script, not to a workflow.
- `npm run check:repo` (in ci) requires every tracked or addable file under src/, scripts/ and tests/ to appear in ProjectLayout.txt. A directory without listed children covers its contents. Deleted files are ignored. Every tests/*.test.js file must also appear in the package.json test command. Keep this map current when adding tooling or tests.
- Build tools use exact devDependency versions for reproducible size checks; package-lock.json stays gitignored. Type declarations are generated into dist/types from JavaScript, with no handwritten src/index.d.ts duplicate. Tooling tests use temporary repos or injected commands and need no network.
- To change a category's code points, edit `scripts/categories.js` and run `npm run gen`; never edit `src/categories.generated.js` or the generated README table by hand. The generated classifier is split in two so each half stays small enough for V8 to inline; the generator fails if the table outgrows that.
- A new export needs a type, an assertion in `tests/sanctifyText.test.min.js`, and a size probe with a budget in `scripts/check-size.js`.
- Tests build invisible characters with `String.fromCodePoint` and never contain them raw. Take the same care in scripts that edit source: shells and heredocs can turn an escaped `\uXXXX` into the raw character without warning. Check edits by printing lines as escaped ASCII.
- This repository is public. Describe downstream consumers generically. Don't name private projects, link to them, or quote their internals in code, docs, commits or the CHANGELOG.
