# Design notes: `text-sanctifier`

Purpose, audiences and invariants. Read before adding features, categories or build targets.

## What it is

Invisible characters enter language, code, configuration and prompts through mistakes, pasted text or attacks. Bidi controls reorder what reviewers see; tag characters hide instructions a model can read. This library inspects characters with exact positions, then removes or normalizes them through presets and flags. It is not an HTML/XSS sanitizer or a full security scanner.

## Two audiences

| | Web: sites and extensions | Node, agents and CI |
| --- | --- | --- |
| Job | Clean user input | Prevent invisible characters being committed; report actionable locations |
| Entry | `text-sanctifier/browser` (prebuilt ESM) | `text-sanctifier` (ESM source), CLI |
| Priority | Small downloads, no dependencies | Correctness, structured output, predictable errors |

Split entry points when constraints diverge. File walking and heavier analysis belong in Node or the CLI; a dedicated server entry point is acceptable. Browser features must earn their size. Code-aware judgement belongs downstream: deciding whether a finding is in an identifier, string or comment requires a syntax tree.

## Why agents are a first-class audience

Agents cannot see these characters in tool output. Shared tooling saves repeated, subtly wrong scripts and lets smaller models handle routine hygiene. Agent-facing requirements:

- Exact offsets, lines, columns, code points and categories; JSON on request. Exit codes: 0 clean, 1 findings or pending changes, 2 usage or I/O error.
- Bounded lists and memory: `maxFindings` caps output while counts remain exact; zero means counts only.
- Complete integration docs; consumers should not need to read source.
- Safe defaults: meaning-destroying transformations must be opt-in or clearly documented.

## Invariants

- **Inspection and purging agree, except U+3000.** `inspectTextDetailed` covers `CONTROL_CHARS_REGEX` union `INVISIBLE_TRASH_REGEX` plus U+3000, tested over U+0000-U+10FFFF. U+3000 is detectable as `nonbreaking_space` but preserved by purging.
- **Nothing a renderer hides goes unreported.** Tests compare categories with every Default_Ignorable_Code_Point in the running Node's Unicode data; newer data must not silently escape coverage.
- **Every import has a size budget.** `scripts/check-size.js` checks individually bundled, tree-shaken, minified, gzipped exports. Detection-only imports must exclude sanitizer and emoji tables; `inspectText`, which reports emoji, must exclude sanitizer. Browser budget: `GZIP_BUDGET_BYTES` in `scripts/browser-build.js`.
- **Inspection and newline counting:** one pass, no input copies; measured performance claims.
- **Caps fail closed on mistakes.** Inspection and hidden-run caps accept non-negative integers or Infinity; omitted/undefined keeps the documented default. Explicit invalid values throw RangeError before scanning. Defaults remain 100 findings and unlimited hidden runs/decoding; untrusted callers must set both hidden caps.
- **Directory discovery never probes stdin.** Pathless `check` always scans `.`; reading stdin requires `-`. This deliberately replaces implicit piped checks, which could hang on an agent's open unused pipe.
- **Emoji matching is an approximation.** A lone regional indicator is a letter, not a flag: emoji purge preserves it, keyboard-only emoji filtering removes it, and `hasEmojis` is false. A lone skin-tone modifier displays as a swatch, so it still counts as emoji. Complete matching sequences remain supported. [UTS #51](https://www.unicode.org/reports/tr51/) distinguishes components, modifier sequences and paired regional indicators; property membership alone is insufficient. Data-driven tools such as [emoji-regex](https://github.com/mathiasbynens/emoji-regex) provide broader matching. Full RGI tables would cost too much browser space; these APIs do not detect payload carriers.
- **Zero runtime dependencies.**
- **Public fields survive minification.** esbuild does not rename properties; dist tests check public fields.
- **Declarations follow source.** Generated from JSDoc, checked with `checkJs` and a strict consumer compiled under NodeNext, Node16, Bundler and Node10 module resolutions.

## Categories are API

Consumers switch on category names and read every `counts` key. Adding code points changes detection and stripping: note behavior in the CHANGELOG. Adding, renaming or splitting categories breaks exhaustive consumers; plan and batch changes deliberately.

Emoji joiners and selector distinctions are answered without category changes by `text-sanctifier/context` and `findHiddenRuns` totals. Still open: `nonbreaking_space` includes breaking spaces U+2000-U+200A, so its name misleads.

## Problems seen in practice

- Model output carries narrow non-breaking and look-alike spaces into code, Markdown and data: replace with ordinary spaces rather than joining words.
- Coding agents cannot match or edit characters they cannot see.
- Rules, skills, tool descriptions and web content hide instructions with tags, selectors and invisible operators.
- Everyday hygiene: BOMs on CSV headers, U+2028/U+2029 breaking JavaScript or JSON, mixed line endings.

## Roadmap: two tracks, one core

Share core work; grow each track in its own entry point. Status as of <!-- gen:release -->1.3.16 (2026-11-09)<!-- /gen -->.

### Shared core

- Coordinate category changes with consumers: rename `nonbreaking_space`; consider U+2028/U+2029, unpaired surrogates, noncharacters, U+FFFD and blank-looking U+1680/U+2800. Sanitizers already replace unpaired surrogates with U+FFFD to prevent newly joined hidden characters. Noncharacters should be reported or replaced with U+FFFD, never deleted.
- One corpus against source and browser builds, preventing behavioral drift.

### Server track

- Dedicated entry point when the first server-only feature needs it.
- Inspect tool descriptions served by live MCP servers; decode variation-selector payloads.
- Per-finding severity and Unicode names; versioned JSON report schema. Names need a table unsuitable for the small browser core.
- Bidi balance checks for unterminated or overlapping controls (Trojan Source).
- `fix`: escape characters instead of deleting; report removals at original offsets; suppress by code point or path.
- Streaming inspection for very large files.
- Context refinements driven by reports: see below.

### Web track

- Form-input presets.
- Optional quote and dash folding for pasted/model text.

### Sizes now

Generated gzipped sizes on `main`; last release <!-- gen:release -->1.3.16 (2026-11-09)<!-- /gen -->. Browser budget: <!-- gen:budget:browser -->3 KiB<!-- /gen -->. Raising budgets requires an explicit decision alongside growth. Direct `sanctifyPasted` import: <!-- gen:size:sanctifyPasted -->1.1 KiB<!-- /gen -->; attached `summonSanctifier.pasted`: <!-- gen:size:summonSanctifier.pasted -->1.5 KiB<!-- /gen -->.

<!-- gen:sizes:start (generated by `npm run gen`; do not edit) -->
| Import | Gzipped bytes | Budget | Headroom |
| --- | ---: | ---: | ---: |
| `inspectTextDetailed` | 985 | 1100 | 115 |
| `revealInvisible` | 705 | 1250 | 545 |
| `getNewlineStats` | 272 | 350 | 78 |
| `getRecommendedSanctifierOptions` | 175 | 250 | 75 |
| `inspectText` | 1045 | 1250 | 205 |
| `summonSanctifier` | 1505 | 1600 | 95 |
| `summonSanctifier.pasted` | 1502 | 1600 | 98 |
| `sanctifyPasted` | 1144 | 1250 | 106 |
| `sanctifyStrict` | 1143 | 1250 | 107 |
| `text-sanctifier/hidden` | 1399 | 1400 | 1 |
| `text-sanctifier/context` | 2119 | 2250 | 131 |
| `VERSION` | 51 | 60 | 9 |
| `everything` | 3067 | 3072 | 5 |
| prebuilt browser file | 3067 | 3072 | 5 |
<!-- gen:sizes:end -->

### Not planned here

- Confusables/homoglyphs (UTS #39 skeletons, mixed-script checks): large tables belong in another layer.
- Code-aware interpretation: requires language parsing downstream.
- Cloud CI by default: checks run locally.

## Context-aware findings

**Not a category split.** Adding `counts` keys changes `TrashCategory` and breaks consumers. Context lives beside existing categories in the separate `text-sanctifier/context` entry point, keeping Unicode property checks out of the core/browser file. `counts[c] - benignCounts[c]` gives exact suspicious counts, even beyond listed findings. See [README rules](README.md#text-sanctifiercontext-inspecttextincontexttext-options) for recognized sequences and script approximations.

**Implementation.** One pass like `inspectTextDetailed`; sticky property regexes (for example `/\p{Extended_Pictographic}/yu`) check finding neighbours. No per-character allocation, no `Intl.Segmenter`; full grapheme segmentation would allocate per cluster without helping these rules. Memory stays flat with `maxFindings` set. Requires Unicode property escapes.

**CLI cleaning.** `fix --keep-benign` shares internal context predicates with inspection, retaining no finding objects. It normalizes lone surrogates and optional look-alike spaces first, removes suspicious invisibles in surrogate-safe chunks with whole-input neighbour checks, then runs remaining cleaning once over the result. Temporary match storage is bounded by chunk size; input/output buffers still scale with file size. Trimming/collapse must never run independently on slices around preserved characters.

The CLI currently enables none of `collapseSpaces`, `trimSpacesAroundNewlines` or `finalTrim`. Per-slice `finalTrim` would remove internal spaces following a preserved selector; a whole-result pass avoids that trap if options expand. A CR and LF separated by a preserved character must stay two line endings: that character still separates them. Suspicious characters removed between CR and LF allow them to normalize as one CRLF.

**Viramas.** Regexes expose no combining-class property. `scripts/gen-virama.js` derives <!-- gen:count:viramas -->69<!-- /gen --> viramas from Node normalization data: canonical reordering places class 9 after class 8 and before class 10. It writes `src/virama.generated.js`; `gen:check` detects changes in Node's Unicode data. Joining_Type is unavailable too; an ArabicShaping.txt table would add size and cannot be checked against Node.

**Supplementary selectors.** `benignSupplementarySelectorCount` counts benign U+E0100-U+E01EF within `benignCounts.variation_selector`. Subtract it from `findHiddenRuns(text).supplementarySelectorCount` for exact suspicious supplementary totals. Subtracting all benign selectors would incorrectly include emoji selectors.

**Why the scanners differ on these selectors.** Context marks lone ideographic/Mongolian selectors benign; hidden-run scanning keeps them in `runs` with `sequence`. Ideographic selectors have many values, allowing ASCII payloads one selector per ideograph. Moving them to `benign` would let AI checks pass payloads and break the subtraction above. Extend `sequence` when consumers need another form.

Another intended difference: when U+FE0E/U+FE0F adjoins another hidden-run character of the same kind (U+270C U+FE0F U+FE0F, or U+FE0E U+180B), `inspectTextInContext` can mark the first presentation selector benign when its preceding base qualifies; `findHiddenRuns` reports the whole run as suspicious. Presentation-selector runs are benign only when they contain a single selector. A run of selectors is suspicious.

**Known limits.**

- Arabic ZWNJ approximation accepts non-left-joining letters such as alef, reh and waw, marking some suspicious characters benign.
- Other joining scripts (Syriac, N'Ko, Mongolian, Adlam, Hanifi Rohingya) never get benign joiners, so legitimate text can warn.
- `Extended_Pictographic` includes text-default copyright/registered symbols and unassigned emoji-range code points. Adjacent selectors/joiners can therefore read benign. `Ideographic` includes U+3006, U+3007, U+3021-U+3029 and Tangut, accepting supplementary selectors after them.
- Each joiner needs sticky-regex checks: memory stays flat but speed depends on content. On 16 M characters (UTF-16 units), `maxFindings: 20`: clean text 62 ms, 5.6 M virama joiners 0.5 s, 8 M Arabic ZWNJ 1.6 s (`npm run bench`).

**Next, when reports call for it.** No open consumer asks. False warnings in joining scripts would justify an exact Joining_Type table from ArabicShaping.txt, with generation data Node cannot validate. Misses beside copyright/registered symbols would justify limiting emoji rules to emoji presentation or VS16 before a joiner. Slow Persian/Indic scans would justify cheap code-unit range checks before property regexes. Selector payload decoding remains on the server roadmap.

## Releases

- Patch-only bumps; minor/major changes require deliberate decisions. Describe behavior changes in CHANGELOG entries.
- Batch nearby work into one release.
- Maintainer publishes with npm 2FA; agents prepare and verify. `release:verify` tags `vX.Y.Z` on the published commit.

Full steps and recovery: [PublishChecklist.txt](PublishChecklist.txt).

## Working in this repo

Follow [CLAUDE.md](CLAUDE.md) for everyday checks, export requirements, generated figures and CHANGELOG policy. Release steps live only in the checklist.

- **Public repository:** describe downstream consumers generically; no private names, links or internals in files, commits or CHANGELOG. Local `.git/info/private-names` is never committed. Plain entries match whole words ignoring case; leading `*` matches substrings; spaces match line breaks. Missing/empty lists skip ordinary checks but block release prep. Check coverage and hook setup: checklist.
- **Repository map:** `check:repo` requires tracked/addable src/, bin/, scripts/ and tests/ files in ProjectLayout.txt; grouped directories cover contents, deleted files are ignored. Every tests/*.test.js must be in npm test.
- **Builds:** exact devDependency versions; package-lock.json gitignored. Generated declarations in dist/types, no handwritten src/index.d.ts. Tooling tests use temporary repos/injected commands and need no network.
- **Categories:** edit `scripts/categories.js`, run `npm run gen`; never hand-edit generated classifier or README table. The classifier has two halves small enough for V8 inlining; generation rejects table growth beyond that limit.
- **Invisible characters:** construct tests with `String.fromCodePoint`; shells/heredocs can turn escapes into raw characters. Inspect edited lines as escaped ASCII.

**Binary heuristic.** Ordinary checking samples the first 8000 bytes: a NUL, more than 5% control bytes, and either invalid UTF-8 or entirely ASCII with at least 8 controls. Any non-ASCII byte in valid UTF-8, even beyond the sample, keeps a file checked. A stray NUL or bad byte cannot hide text. Stdin is never binary. AI scans additionally skip known signatures and image/font/archive extensions. Directory/glob `fix` also skips any NUL in the sample; explicit files can be cleaned. Encoding/refusal behavior remains in [README Inputs](README.md#inputs).

**Memory measurements.** 16 M characters (UTF-16 units) of non-breaking spaces produce 16 M findings. With `maxFindings: 20`, scanning takes about 80 ms and uses 0.2 MB; uncapped lists can require roughly 100-200 bytes per finding, about 1.5 GB for 8 million. With `maxRuns` and `maxDecodedLength` set, the same character count of hidden text grows the heap by under 1 MB, versus hundreds of MB uncapped. These are measurements, not budgets; run `npm run bench` locally.
