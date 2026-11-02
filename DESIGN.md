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
- **Every import stays within its size budget.** `scripts/check-size.js` bundles each export on its own, tree-shaken and minified, and checks its gzipped size; detection-only imports must not contain the sanitizer or the emoji tables, and `inspectText`, which reports emoji, must not contain the sanitizer. The prebuilt browser file has its own budget (`GZIP_BUDGET_BYTES` in `scripts/build.js`).
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

The goal is for the web and server tracks to move forward together without drifting apart. Shared work goes in the core; each track grows only in its own entry point. Status as of November 2026.

### Shared core (both tracks)

- **Done: one table of categories and code-point ranges, used everywhere.** `scripts/categories.js` is the table, and `npm run gen` generates the purge regexes and the classifier (`src/categories.generated.js`), the category list in the `inspectTextDetailed` JSDoc and the README table. `npm run ci` fails while any of them is stale. They are generated rather than built at module load, so the browser bundle ships no table or builder and the classifier stays plain number comparisons.
- **Done: complete coverage of Default_Ignorable_Code_Point**, the Unicode property for characters renderers must draw as nothing. A test checks it against the running Node's Unicode data, so a Node upgrade with newer Unicode fails until the table catches up.
- **Next: one planned set of category changes** for both tracks. It covers the open questions above (the `nonbreaking_space` name; the emoji joiner and the two kinds of variation selector are now answered without a category change, by `text-sanctifier/context` and the `findHiddenRuns` totals) and characters that are not invisible but still cause trouble: U+2028/U+2029 line and paragraph separators, unpaired surrogates, noncharacters (to be reported or replaced with U+FFFD, never deleted), U+FFFD itself as a sign of a decoding error, and blank-looking characters such as U+1680 and U+2800.
- **Done: a reveal helper.** `revealInvisible` and `text-sanctifier reveal` render hidden characters visibly as `<U+XXXX>` markers, as Unicode's source-code guidance (UTS #55) recommends, for logs, diffs and agent tool output. Unicode character names in markers would need a name table, so they belong in the server track.
- **One test corpus run against both builds**, so the source build and the browser build can never report differently.

### Server track (Node, agents, CI)

Capability over size.

- **A dedicated server entry point** (for example `text-sanctifier/server`) for features that don't belong in the browser bundle.
- **Done: a check for AI configuration files.** `text-sanctifier check --ai-config` searches for rules files, agent skill files, `CLAUDE.md`/`AGENTS.md` and MCP configuration, reports runs of tag characters, variation selectors and invisible operators, and decodes the ASCII hidden in tag runs. The England, Scotland and Wales flags and a lone presentation selector are left out. Still open: tool descriptions served by a running MCP server, and decoding data hidden in variation selectors.
- **Done: integration that runs locally.** `check --format sarif` (SARIF 2.1.0, a level per category, set in the command line) and `.pre-commit-hooks.yaml` with two hooks. No cloud CI.
- **Findings an agent can act on directly:** a severity and the Unicode character name on each finding, and a versioned JSON schema for reports from the library and the command-line tool.
- **Context-aware findings**, to tell legitimate emoji joiners, colour selectors and flag sequences (and joiners in scripts that need them) from hidden ones. Built: see "Context-aware findings" below.
- **A bidi balance check** for unterminated or overlapping bidi controls, the specific Trojan Source pattern.
- **`fix` options and reports:** rewrite characters in source as escape sequences instead of deleting them, list each removal by its offset in the original text, and allow suppressions by code point or path.
- **Streaming inspection** for very large files.

### Web track (websites, browser extensions)

Size over features.

- **Done: gzipped size budgets enforced by `npm run ci`, per import.** Bundler users pay only for what they import, so each export has its own budget in `scripts/check-size.js` (for example about 1 KB for `inspectTextDetailed`), plus leak checks. The prebuilt browser file, for pages with no build step, keeps a 3072-byte budget (`GZIP_BUDGET_BYTES` in `scripts/build.js`); it is 3035. Raising the budget is a deliberate decision made in the same commit as the growth.
- **Done: a preset for model output and pasted text.** `summonSanctifier.pasted` turns look-alike spaces into ordinary spaces and removes zero-width spaces, while keeping emoji joiners, selectors and bidi marks. `fix` now does the same with spaces by default and reports replacements apart from removals. Still open: optional quote and dash folding.
- **Presets for cleaning form input.**
- **Done: per-import size budgets.** Bundlers import the ESM source and keep only what is used, so size is checked per export (`scripts/check-size.js`) rather than only for the prebuilt file.
- **Done: `inspectText` no longer pulls in the sanitizer.** The patterns it shares with the sanitizer (the emoji regex, the keyboard-safe regex and the typographic normalizer) live in `src/textPatterns.js`, and the emoji regex is built by a function marked pure instead of in a top-level `try`. `inspectText` went from 1882 to 1106 bytes gzipped, and its size probe now fails if the sanitizer leaks back in.
- **Done: standalone preset exports.** Each preset is its own export (`sanctifyStrict`, `sanctifyLoose`, `sanctifyKeyboardOnly`, `sanctifyKeyboardOnlyEmoji`, `sanctifyPasted`), and `summonSanctifier` attaches the same functions in an `Object.assign` call marked pure instead of top-level property assignments. Importing one preset is about 1.1 KB gzipped instead of 1.45 KB. The new names cost 40 bytes on `summonSanctifier` and 73 on the prebuilt browser file (3016 of 3072 bytes), which leaves that budget 56 bytes of headroom: the next addition to the browser file needs a decision about its budget or what it includes.
- **Done: bounded hidden-run scans.** `findHiddenRuns` takes `maxRuns` and `maxDecodedLength`, keeps `counts`, `total` and `benignTotal` exact, and gives each run `line` and `column` counted as `inspectTextDetailed` counts them, so callers no longer need their own scan limit or position code. The reserved code points of the tag plane (U+E0080–U+E00FF, U+E01F0–U+E0FFF) are a run kind of their own, `reserved_tag_plane`, so hidden-text scans cover the whole block up to U+E0FFF without a new category. With both caps set, 16 M characters (32 MB) of hidden text grow the heap by under 1 MB. `VERSION` is exported (generated from `package.json`), costing 19 bytes in the browser file, which is now 3035 of 3072. Still open: `check --ai-config` takes run positions from an uncapped `inspectTextDetailed` call and could use the run fields instead.

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

**Rules** (conservative: when in doubt, not benign):
- U+200D between two `Extended_Pictographic` code points, allowing a skin-tone modifier or VS16 after the first: an emoji ZWJ sequence.
- U+FE0E or U+FE0F directly after a code point that has an emoji presentation (`Extended_Pictographic`, or a keycap base followed by U+20E3).
- U+E0100–U+E01EF, one selector directly after an `Ideographic` code point: an ideographic variation sequence.
- U+180B–U+180D, U+180F directly after a Mongolian letter.
- Tag characters forming the England, Scotland or Wales flag, as `findHiddenRuns` already decides.
- U+200C or U+200D directly after a virama, and U+200C between two Arabic-script letters: see "Script joiners" below.
- Never benign: U+200B, U+2060, U+FEFF (a BOM at offset 0 already has `atStart`), bidi controls, other tags, everything else.

**Implementation.** The same single pass as `inspectTextDetailed`, checking only the neighbours of each finding with sticky regexes (`/\p{Extended_Pictographic}/yu` at an index), so nothing is allocated per character and memory stays flat with `maxFindings` set. Neighbour checks match the rules above exactly and need no `Intl.Segmenter`; full grapheme segmentation would allocate per cluster and decide nothing these rules don't. It needs Unicode property escapes in regexes (ES2018: Node 10+, every current browser).

**Script joiners.** Persian needs ZWNJ between letters, and Indic scripts need ZWJ and ZWNJ after a virama to choose conjunct, half and explicit-virama forms. The rules follow IDNA ContextJ (RFC 5892, appendix A.1 and A.2), the established standard for where joiners are legitimate:
- U+200C or U+200D directly after a code point with Canonical_Combining_Class 9 (Virama). JavaScript regexes have no property for combining classes, so `scripts/gen-virama.js` derives the 69 viramas from Node's own normalization data (canonical reordering puts a class 9 mark after class 8 and before class 10) and writes `src/virama.generated.js`. `npm run gen:check` fails when Node's Unicode data changes the set. Exact.
- U+200C between two Arabic-script letters (`(?=\p{Script=Arabic})\p{L}`), skipping nonspacing marks (`\p{Mn}`) on both sides. The RFC asks for Joining_Type L or D before and R or D after, with transparent marks between; Joining_Type is not a regex property, and shipping ArabicShaping.txt as a table would cost bytes and could not be checked against Node. So this rule is approximate: it also accepts a ZWNJ after a right-joining or non-joining Arabic letter, and it accepts none in the other joining scripts (Syriac, N'Ko, Mongolian, Adlam and others).
- ZWJ between Arabic letters is not benign; the RFC allows ZWJ only after a virama.

**Supplementary selectors, exactly.** `benignSupplementarySelectorCount` counts the benign U+E0100–U+E01EF, part of `benignCounts.variation_selector`. `findHiddenRuns(text).supplementarySelectorCount` counts every one of them (it never marks them benign), so the difference is the exact number of suspicious ones, which `benignCounts.variation_selector` alone can't give because it also counts emoji selectors.

**Related ask: code-point totals per run kind.** `findHiddenRuns` counts runs, not their length. A `codePointCounts` field with the same keys as `counts` (total code points per kind) gives exact totals beyond the listed runs, and a `supplementarySelectorCount` (U+E0100–U+E01EF, counted apart from U+FE00–U+FE0F) separates the selectors that can carry data from emoji selectors. Additive; built as proposed.

**Size and tests.** Its own size probe and budget; core probes unchanged. Tests: every rule with positive and negative cases, `benignCounts` equal to the benign listed findings when nothing is truncated, `benignCounts[c] <= counts[c]`, and the 16 M-unit heap check.

**Known limits.** Each errs in one known direction, and none has been reported as a problem in real text:
- The Arabic-script ZWNJ rule is approximate (see "Script joiners"): it accepts a ZWNJ after letters that don't join to the left, such as alef, reh and waw, so a few suspicious characters read as benign.
- Joiners in the other joining scripts (Syriac, N'Ko, Mongolian, Adlam, Hanifi Rohingya and others) are never benign, so legitimate ones read as suspicious.
- `Extended_Pictographic` includes text-default symbols such as © and ® and unassigned code points in the emoji ranges, so a joiner or selector next to one reads as benign. `Ideographic` includes U+3006, U+3007, U+3021–U+3029 and Tangut, so a supplementary selector after one reads as benign.
- Speed: memory stays flat, but every joiner costs a few sticky-regex tests. On 16 M UTF-16 units with `maxFindings: 20` (Node 24): clean text 63 ms, 5.6 M virama joiners 0.4 s, 8 M Persian ZWNJ 1.5 s.

**Next, when reports call for it.** No consumer has open asks, so the next round waits for false warnings or misses seen in real text. What each kind of report would lead to:
- False warnings on Syriac, N'Ko or other joining scripts: an exact Joining_Type table generated from Unicode's ArabicShaping.txt, replacing the Arabic-script approximation. Costs bytes in this entry point and a data file at generation time that Node can't check.
- Misses next to © or ®: limit the emoji rules to code points with emoji presentation, or a VS16 before the joiner.
- Slow scans on large Persian or Indic input: test cheap code-unit ranges (the Arabic blocks, the virama table's BMP part) before the property regexes.
- A selector that carries data after a legitimate base: decoding data hidden in variation selectors, already listed under the server track.

## Releases

- Bump the patch number only, even for new exports or behavior changes. Batch work done close together into one release. Changing the minor or major number is a deliberate decision. See `PublishChecklist.txt`.
- Describe behavior changes in `CHANGELOG.md` instead of signalling them through the version number.
- Tag releases `vX.Y.Z` on the commit that was published.
- After bumping `package.json`, run `npm run gen`: the `VERSION` export is generated from it, and `npm run ci` fails while it is stale.
- Publishing needs the maintainer's npm two-factor credentials. Agents prepare and verify releases; a maintainer publishes.

## Working in this repo

- `npm run ci` runs the generated-file check, the tests, both builds, the type check and the dist tests. Run it before every commit.
- CI here means the local `npm run ci` script. The repo deliberately has no cloud CI (GitHub Actions or similar), so checks cost nothing to run. Add new checks to the script, not to a workflow.
- To change a category's code points, edit `scripts/categories.js` and run `npm run gen`; never edit `src/categories.generated.js` or the generated README table by hand. The generated classifier is split in two so each half stays small enough for V8 to inline; the generator fails if the table outgrows that.
- A new export needs a type, an assertion in `tests/sanctifyText.test.min.js`, and a size probe with a budget in `scripts/check-size.js`.
- Tests build invisible characters with `String.fromCodePoint` and never contain them raw. Take the same care in scripts that edit source: shells and heredocs can turn an escaped `\uXXXX` into the raw character without warning. Check edits by printing lines as escaped ASCII.
- This repository is public. Describe downstream consumers generically. Don't name private projects, link to them, or quote their internals in code, docs, commits or the CHANGELOG.
