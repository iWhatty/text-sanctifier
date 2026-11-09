# text-sanctifier

[![npm](https://badgen.net/npm/v/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![downloads](https://badgen.net/npm/dm/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![bundle size](https://badgen.net/static/gzip/under%203%20KiB/green)](https://bundlejs.com/?q=text-sanctifier)
[![license](https://badgen.net/static/license/AGPL-3.0%20%2B%20terms/blue)](https://github.com/iWhatty/text-sanctifier/blob/main/LICENSE)
[![stars](https://badgen.net/github/stars/iWhatty/text-sanctifier)](https://github.com/iWhatty/text-sanctifier)
[![types](https://badgen.net/npm/types/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)

Find/remove invisible Unicode in web input, model-bound text and repositories. Prebuilt browser file: under <!-- gen:budget:browser -->3 KiB<!-- /gen --> gzipped; bundlers include only used imports.

## Features

- **Clean:** invisible/control characters (including Trojan Source bidi controls and LLM "ASCII smuggling" tags), look-alike spaces, emoji and newlines.
- **Inspect:** exact offsets, lines, columns and categories; visible markers; context-aware findings and decoded hidden tag text.
- **CLI:** repository and AI configuration checks, fixes, JSON or SARIF output, exit codes and local pre-commit hooks.

---

## Install

```sh
pnpm add text-sanctifier
# or
npm i text-sanctifier
```

## Which import do I use?

| Job | Import or command |
| --- | --- |
| Sanitize text with presets | `import { sanctifyPasted, sanctifyStrict } from 'text-sanctifier'` |
| Find and locate characters | `import { inspectTextDetailed } from 'text-sanctifier'` |
| Emoji-aware findings | `import { inspectTextInContext } from 'text-sanctifier/context'` |
| Text headed to a model | `import { findHiddenRuns, decodeTagText } from 'text-sanctifier/hidden'` |
| No build step | `import { sanctifyPasted } from 'https://cdn.jsdelivr.net/npm/text-sanctifier/dist/text-sanctifier.min.js'` |
| Repository checks | `npx text-sanctifier check` |

## Quick start

### Web

```js
import { sanctifyPasted } from 'text-sanctifier';
const input = 'Hello\u202Fworld\u200B';
const clean = sanctifyPasted(input); // 'Hello world'
document.querySelector('#preview').textContent = clean;
```

Without a build step, use the browser file from a CDN:

```html
<div id="preview"></div>
<script type="module">
  import { sanctifyPasted } from 'https://cdn.jsdelivr.net/npm/text-sanctifier/dist/text-sanctifier.min.js';
  document.querySelector('#preview').textContent = sanctifyPasted('Hello\u200B world');
</script>
```

### Agents/CI

```sh
npx text-sanctifier check src docs
npx text-sanctifier check --ai-config
# check exits: 0 clean, 1 findings, 2 usage or I/O error
```

---

## Security notes

- **Not an HTML/XSS sanitizer.** This library normalizes and filters plain text.
- If you need to render **untrusted content**, render it as text (e.g. `textContent`), not HTML (`innerHTML`).
- If you need to sanitize **HTML**, use a dedicated HTML sanitizer (e.g. DOMPurify / sanitize-html).
- Like any text-processing library, extremely large untrusted inputs can be used for CPU/DoS pressure; set input size limits with [`maxLength` and `onMaxLength`](#sanctifyoptions) in high-risk environments. Inspection caps limit output, not input length or scan time.

---

## API

### `summonSanctifier(options?: SanctifyOptions): (text: string) => string`

Creates a reusable sanitizer from an option object.

### `SanctifyOptions`

Used by `summonSanctifier(options)`. All boolean options default to `false`. Processing follows table order after the input-length check.

| Option | Behavior |
| --- | --- |
| `normalizeSpaces` | Replace U+00A0, U+2000-U+200A, U+202F and U+205F with ordinary spaces; keep U+3000. |
| `purgeZeroWidthSpaces` | Remove only U+200B, U+2060 and U+FEFF. |
| `purgeInvisibleChars` | Remove characters marked `purgeInvisibleChars` in the category table, except U+3000, including emoji joiners and selectors. |
| `purgeEmojis` | Remove matched emoji sequences, including flags and keycaps. Text-default pictographs such as copyright and trademark require U+FE0F to count as emoji. |
| `nukeControls` | Remove NUL, non-whitespace C0 controls, DEL, C1 controls and bidi controls; keep tab, LF and CR. |
| `keyboardOnlyFilter` | Normalize typographic punctuation and U+3000 to ASCII, then keep printable ASCII, CR/LF and matched emoji sequences; with `purgeEmojis`, keep no emoji. Deletes non-ASCII letters and plain copyright and trademark signs. |
| `normalizeNewlines` | Convert CRLF and CR to LF. |
| `trimSpacesAroundNewlines` | Normalize newlines, then remove spaces and tabs immediately around LF runs. |
| `collapseNewLines` | Normalize newlines, then collapse runs of two or more LFs to one, or three or more to two with `preserveParagraphs`. |
| `preserveParagraphs` | Keep double LF breaks when `collapseNewLines` is enabled; otherwise no effect. |
| `collapseSpaces` | Collapse runs of ordinary spaces to one; keep tabs and newlines. |
| `finalTrim` | Apply JavaScript `.trim()` to the result. |
| `maxLength` | Input cap in UTF-16 code units, checked before processing. Default `Infinity`; negative, non-finite or non-number values mean no cap. |
| `onMaxLength` | Default `'throw'`: throw `RangeError` above the cap. `'truncate'`: slice input to at most the cap before processing, never through a surrogate pair. `'noop'`: return original input unchanged. Invalid values use `'throw'`. |

```js
import { summonSanctifier } from 'text-sanctifier';
const clean = summonSanctifier({ purgeInvisibleChars: true, maxLength: 10000, onMaxLength: 'throw' });
```

Sanitizers replace unpaired surrogates with U+FFFD first, preventing removals from joining surrogate halves.

### Errors

Every text-processing export throws `TypeError` for non-strings; no coercion. Sanitizers throw `RangeError` above `maxLength` with `onMaxLength: 'throw'`.

### Presets

Standalone exports are the same functions as the corresponding `summonSanctifier` properties. Direct imports tree-shake (about <!-- gen:size:sanctifyPasted -->1.1 KiB<!-- /gen --> gzipped versus <!-- gen:size:summonSanctifier.pasted -->1.5 KiB<!-- /gen -->).

| Export / property | What it does | What it keeps |
| --- | --- | --- |
| `sanctifyStrict` / `.strict` | Normalize look-alike spaces; purge invisible characters, emoji and controls; normalize newlines, trim spaces/tabs around LF, collapse blank lines and spaces, trim ends. | Single line breaks. |
| `sanctifyLoose` / `.loose` | Collapse spaces; normalize newlines and trim spaces/tabs around LF; collapse LF runs to at most two; trim ends. | Emoji, paragraph breaks, zero-width characters, bidi overrides and isolates, C0 controls including BEL and NUL. |
| `sanctifyKeyboardOnly` / `.keyboardOnly` | Normalize look-alike spaces/punctuation/newlines; remove emoji and non-ASCII letters; trim around LF and ends, collapse spaces/blank lines. | Printable ASCII and line breaks. |
| `sanctifyKeyboardOnlyEmoji` / `.keyboardOnlyEmoji` | Normalize punctuation/newlines; trim spaces/tabs around LF and ends; delete non-ASCII letters without transliteration. | Printable ASCII, line breaks and matched emoji sequences, including ZWJ clusters and presentation variants. |
| `sanctifyPasted` / `.pasted` | For pasted documents and model output: normalize look-alike spaces and newlines; remove U+200B, U+2060 and U+FEFF. | Emoji joiners, selectors, bidi overrides and isolates, C0 controls including BEL and NUL, indentation, blank lines and end whitespace. |

Loose and pasted keep bidi overrides/isolates (U+202A-U+202E, U+2066-U+2069). For untrusted text, use `sanctifyStrict` or `purgeInvisibleChars` with `nukeControls`. Purging without space normalization joins words separated by look-alike spaces.

```js
import { sanctifyPasted } from 'text-sanctifier';
const output = sanctifyPasted(clipboardText);
```

### `revealInvisible(text: string, options?: RevealOptions): string`

Makes every `inspectTextDetailed` finding visible; preserves everything else, including tabs and newlines. Emoji joiners, selectors and flag tags become markers too.

```js
import { revealInvisible } from 'text-sanctifier';

revealInvisible('a\u200Bb\u{E0041}');                    // 'a<U+200B>b<U+E0041>'
revealInvisible('a\u202Eb', { format: (codePoint, category) => `[${category}]` }); // 'a[bidi_control]b'
```

Default: `<U+XXXX>`, uppercase hex, minimum four digits, no cap. Literal markers look identical; use `format(codePoint, category)` to avoid collisions.

### `inspectText(text: string): UnicodeTrashReport`

Returns `{ hasControlChars, hasInvisibleChars, hasMixedNewlines, newlineStyle, hasEmojis, hasNonKeyboardChars, summary }`. `newlineStyle`: `'LF'`, `'CRLF'`, `'CR'`, `'Mixed'` or `null`; `summary`: human-readable messages.

```js
import { inspectText, getRecommendedSanctifierOptions, summonSanctifier } from 'text-sanctifier';
const report = inspectText(input);
const clean = summonSanctifier(getRecommendedSanctifierOptions(report));
```

Recommendations enable cleaning flags; destructive `purgeEmojis` and `keyboardOnlyFilter` remain opt-in.

### `inspectTextDetailed(text: string, options?: { maxFindings?: number }): DetailedTrashReport`

Reports invisible and control characters with exact positions, categories and counts.

```js
import { inspectTextDetailed } from 'text-sanctifier';

const { findings, counts, total, truncated } = inspectTextDetailed(input, { maxFindings: 100 });

// findings: [{ offset: 0, line: 1, column: 1, codePoint: 0xFEFF, category: 'bom', atStart: true }]
// counts: every category below; total: all occurrences; truncated: omitted findings
```

<!-- categories:start (generated from scripts/categories.js by `npm run gen`; do not edit) -->
| Category | Code points | Removed by |
| --- | --- | --- |
| `bidi_control` | U+061C, U+200E, U+200F, U+202A–U+202E, U+2066–U+2069 | `nukeControls`, `purgeInvisibleChars` |
| `zero_width` | U+200B–U+200D, U+2060 | `purgeInvisibleChars` |
| `nonbreaking_space` | U+00A0, U+2000–U+200A, U+202F, U+205F, U+3000 (non-breaking and typographic spaces) | `purgeInvisibleChars` |
| `bom` | U+FEFF (`atStart` is true at offset 0, where a BOM is legitimate) | `purgeInvisibleChars` |
| `nul` | U+0000 | `nukeControls` |
| `c0_control` | U+0001–U+0008, U+000B, U+000C, U+000E–U+001F, U+007F (tab, LF and CR are whitespace, not trash) | `nukeControls` |
| `c1_control` | U+0080–U+009F | `nukeControls` |
| `invisible_format` | U+00AD (soft hyphen), U+034F (combining grapheme joiner), U+17B4, U+17B5 (Khmer inherent vowels), U+180E (Mongolian vowel separator), U+2061–U+2064 (invisible operators), U+2065 (reserved), U+206A–U+206F (deprecated format characters), U+FFF0–U+FFF8 (reserved), U+1BCA0–U+1BCA3 (shorthand format controls), U+1D173–U+1D17A (musical formatting), U+E0080–U+E00FF (reserved), U+E01F0–U+E0FFF (reserved) (every other Default_Ignorable_Code_Point, which renderers draw as nothing) | `purgeInvisibleChars` |
| `hangul_filler` | U+115F, U+1160, U+3164, U+FFA0 (letters that render blank) | `purgeInvisibleChars` |
| `variation_selector` | U+180B–U+180D (Mongolian FVS1-FVS3), U+180F (Mongolian FVS4), U+FE00–U+FE0F (VS1-VS16, including VS16 in emoji), U+E0100–U+E01EF (VS17-VS256) | `purgeInvisibleChars` |
| `tag` | U+E0000–U+E007F (tag characters, used for "ASCII smuggling" of hidden instructions) | `purgeInvisibleChars` |
<!-- categories:end -->

Categories include legitimate text; see [context rules](#text-sanctifiercontext-inspecttextincontexttext-options). Purging joiners, selectors and flag tags changes emoji/Mongolian text; `keyboardOnlyEmoji` preserves matched emoji. Categories cover Default_Ignorable_Code_Point and what `nukeControls`/`purgeInvisibleChars` strip, except detectable-but-preserved U+3000.

`codePoint` is a full code point, not a surrogate. `offset`: zero-based UTF-16 index, high surrogate for astral characters. `line`/`column`: one-based, UTF-16 columns; LF, CR and CRLF end lines. Counts include every occurrence. `maxFindings`: default 100, `Infinity` lists all; negative/fractional numbers, strings, `NaN` and `null` fall back to 100. `truncated` means findings were omitted. One pass, no regex or input copy.

Set `maxFindings: 0` for counts only; no finding objects are built. Memory stays flat with caps set; see [maintainer measurements](DESIGN.md#working-in-this-repo).

### `getNewlineStats(text: string): NewlineStats`

One pass, no regex/copy: `{ crlf, cr, lf, types, mixed }`. `cr` and `lf` exclude CRLF pairs; `types` lists present styles in `'CRLF'`, `'CR'`, `'LF'` order; `mixed` means multiple styles.

```js
import { getNewlineStats } from 'text-sanctifier';

getNewlineStats('a\r\nb\n'); // { crlf: 1, cr: 0, lf: 1, types: ['CRLF', 'LF'], mixed: true }
```

### `text-sanctifier/hidden`: `findHiddenRuns(text, options?)` and `decodeTagText(text)`

Hidden-text scanning for model-bound input and [`check --ai-config`](#ai-configuration-files). Browser-compatible, separate from the prebuilt browser bundle.

```js
import { findHiddenRuns, decodeTagText } from 'text-sanctifier/hidden';

const { runs, benign, counts, total, truncated } = findHiddenRuns(text, { maxRuns: 100, maxDecodedLength: 1000 });
// runs:   [{ kind: 'tag', offset, end, line, column, count, decoded: 'Ignore the user', decodedTruncated: false }, ...]
// benign: [[offset, end], ...]  recognized flags and lone presentation selectors (see context rules)
// counts: { tag, variation_selector, invisible_operator, reserved_tag_plane }, every run listed or not; total is their sum
```

- `kind` is `tag` (U+E0000–U+E007F), `variation_selector` (U+FE00–U+FE0F, U+E0100–U+E01EF, U+180B–U+180D, U+180F), `invisible_operator` (U+2061–U+2064) or `reserved_tag_plane` (U+E0080–U+E00FF, U+E01F0–U+E0FFF: unassigned, default ignorable, so they render as nothing and can carry data). Consecutive characters of one kind form one run.
- `offset`/`end`: UTF-16 `[offset, end)`; `count`: code points. Positions follow `inspectTextDetailed`. Only tags have `decoded`/`decodedTruncated`.
- `sequence`: lone `'ideographic'` or `'mongolian'` selector under [context rules](#text-sanctifiercontext-inspecttextincontexttext-options). These stay in `runs`: selectors can carry data, up to a byte per ideograph. Recognized flags/presentation selectors go in `benign`; [multi-selector runs stay suspicious](DESIGN.md#context-aware-findings).
- `maxRuns` separately caps `runs` and `benign`; `counts`, `total`, `benignTotal` stay exact. `truncated` means either list was cut. `maxDecodedLength` caps each `decoded` string in UTF-16 units without splitting markers. Both default to `Infinity`; only non-negative integers or `Infinity` are valid. Invalid values, including `null`, mean no cap. Set both for untrusted input.
- `decodeTagText` turns U+E0020–U+E007E into the ASCII they shadow and writes any other character as `<U+XXXX>`.
- Zero-width, bidi and other invisible characters are not runs; use `inspectTextDetailed` for those.
- `codePointCounts`: code-point totals per `counts` key. `supplementarySelectorCount`: U+E0100-U+E01EF only. Both exclude benign spans and remain exact under caps.
- `VERSION` is exported here and from the package root: the installed version, as in `package.json`.

### `text-sanctifier/context`: `inspectTextInContext(text, options?)`

Extends `inspectTextDetailed` with `benign: true` or `false` on findings and exact `benignCounts`, even beyond listed findings. Categories and `counts` stay unchanged.

```js
import { inspectTextInContext } from 'text-sanctifier/context';

const report = inspectTextInContext(text, { maxFindings: 20 });
const suspicious = report.counts.zero_width - report.benignCounts.zero_width; // U+200B, U+2060, stray U+200D
```

Benign, and nothing else:

- U+200D between two emoji (`Extended_Pictographic`), allowing a skin-tone modifier or VS16 after the first
- U+FE0E or U+FE0F directly after an emoji, or in a keycap (0-9, # or *, the selector, U+20E3)
- one of U+E0100–U+E01EF directly after an ideograph
- U+180B–U+180D or U+180F directly after a Mongolian letter
- the tags of England, Scotland and Wales flags: U+1F3F4, tag letters spelling `gbeng`, `gbsct` or `gbwls`, U+E007F
- U+200C or U+200D directly after a virama (Devanagari, Bengali, Tamil, Malayalam, Sinhala, Myanmar and the other scripts with one), as IDNA ContextJ (RFC 5892) allows
- U+200C between two Arabic-script letters, skipping marks, as in Persian. This approximates the RFC's joining-type rule: it also accepts a ZWNJ after a letter that does not join to the left, and none in other joining scripts such as Syriac

U+200B, U+2060, U+FEFF, bidi controls and all other tags are never benign, and neither is U+200D between Arabic letters. Requires Unicode property escapes; separate from the browser file, about <!-- gen:size:text-sanctifier/context -->2.0 KiB<!-- /gen --> gzipped on its own.

`benignSupplementarySelectorCount` counts the benign ideographic selectors U+E0100–U+E01EF. With `findHiddenRuns` from `text-sanctifier/hidden`, `scan.supplementarySelectorCount - report.benignSupplementarySelectorCount` is the exact number of suspicious ones.

---

## Command line

The `text-sanctifier` command runs locally for CI and agents.

```sh
npx text-sanctifier --help
npx text-sanctifier --version
npx text-sanctifier check
npx text-sanctifier check src docs "**/*.md"
npx text-sanctifier fix --dry-run src
npx text-sanctifier reveal notes.md
```

### `check [paths...]`

Reports every invisible or control character as `path:line:column  U+XXXX  category`, using the categories of `inspectTextDetailed`:

```
docs/intro.md:12:7  U+200B  zero_width
src/auth.js:40:3  U+202E  bidi_control
2 findings in 2 of 31 files.
```

- `--json` (or `--format json`): stdout `{ files, total, filesScanned, filesWithFindings, skipped, excluded, notUtf8, errors }`. `files`: `{ path, ...inspectTextDetailed(text) }`, findings only. Usage errors also emit JSON.
- `--exclude GLOB`: exclude matching paths; repeatable. See [Inputs](#inputs). Not available with `--ai-config`.
- `--format sarif`: [SARIF output](#sarif-output) for code-scanning viewers/editors.
- `--max-findings N`: findings listed per file (default 100; `all` for no cap). Counts always cover every occurrence.
- `--strip-bom`: also report a BOM at offset 0, which is skipped by default.
- `--ai-config`: check agent instruction files for hidden text. See [AI configuration files](#ai-configuration-files).

### AI configuration files

`check --ai-config` scans rules, skills and MCP configuration for hidden instructions.

```sh
npx text-sanctifier check --ai-config
```

- Directories you name are searched by the same rules; named files are checked regardless of name. Git-ignored files are skipped.
- Case-insensitive matches at any depth: `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `AGENT.md`, `GEMINI.md`, `SKILL.md`, `.claude/**`, `.cursorrules`, `.cursor/rules/**`, `.cursor/mcp.json`, `.windsurfrules`, `.windsurf/rules/**`, `.clinerules` (file/directory), `.roorules`, `.roo/rules/**`, `.github/copilot-instructions.md`, `.github/{instructions,prompts,chatmodes,agents}/**`, `.mcp.json`, `mcp.json`, `.vscode/mcp.json`.
- Consecutive characters of one hidden-run kind are reported at their first character; tag text is decoded as by `decodeTagText`.
- Every other invisible or control character is reported as in a plain `check`.
- Recognized flags and lone presentation selectors are excluded under the [context rules](#text-sanctifiercontext-inspecttextincontexttext-options); ideographic and Mongolian selectors stay suspicious runs (see [scanner differences](DESIGN.md#context-aware-findings)). Plain `check` reports all of them.
- `--json` adds `hiddenRuns` (`{ kind, offset, line, column, codePoint, count, sequence?, decoded?, decodedTruncated? }`, at most `--max-findings` per file) and `hiddenRunCount` to each file, and `hiddenRunCount` to the summary. `kind` is `tag`, `variation_selector`, `invisible_operator` or `reserved_tag_plane`; `decoded` is cut at 1000 characters. `total` and `counts` leave out the legitimate sequences.

### SARIF output

`check --format sarif`, including `--ai-config`, emits one [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) log, one result per listed finding:

- `ruleId` is the category, and `tool.driver.rules` lists every category.
- `level`: `error` for `bidi_control` and `tag`, `note` for `nonbreaking_space`, `warning` for the rest.
- Locations: file relative to `%SRCROOT%` (current directory), `startLine`, `startColumn`, `endColumn`; `columnKind: "utf16CodeUnits"`.
- `partialFingerprints`: hash of rule, relative path, line content and occurrence on that line; unaffected by unrelated inserted lines above.
- With `--ai-config`, the message of the first result in a run describes the run and its decoded text.
- `--max-findings` caps per file. `runs[0].properties`: `total`, `filesScanned`, `filesWithFindings`, `truncated` (files with omissions), `skipped`, `excluded`.

### pre-commit

Local [pre-commit](https://pre-commit.com) hooks:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/iWhatty/text-sanctifier
    rev: v1.3.14  # a release tag
    hooks:
      - id: text-sanctifier            # every staged text file
      - id: text-sanctifier-ai-config  # agent instruction files, with --ai-config
```

- `text-sanctifier`: staged text files. pre-commit may skip files with early control bytes; use repository `check` for full coverage. Configure `exclude:` or `args: [--strip-bom]` and other `check` options.
- `text-sanctifier-ai-config`: staged files matching the AI configuration list.
- Findings block commits (exit 1); hooks never modify files. Run `fix` yourself.

### `fix [paths...]`

Rewrites files in place and reports what it replaced and removed.

- `--normalize-spaces`: `normalizeSpaces` (look-alike spaces become ordinary spaces)
- `--purge-invisible`: `purgeInvisibleChars`
- `--keep-benign`: preserve [contextually benign sequences](#text-sanctifiercontext-inspecttextincontexttext-options) while purging, including with default cleaning flags. With explicit cleaning flags it needs `--purge-invisible`.
- `--nuke-controls`: `nukeControls`
- `--normalize-newlines`: `normalizeNewlines` (CRLF and CR to LF)
- Default cleaning flags: `--normalize-spaces --purge-invisible --nuke-controls`; normalize spaces, delete other `check` findings except U+3000.
- `--strip-bom`: also remove a BOM at offset 0. It is kept by default.
- `--dry-run`: write nothing; report what would change.
- `--exclude GLOB`: exclude matching paths; repeatable. See [Inputs](#inputs).
- `--json` (or `--format json`): `{ files, dryRun, filesScanned, filesChanged, skipped, excluded, errors }`, where each file is `{ path, spacesReplaced, removed, removedTotal, newlinesNormalized }`. Usage errors also produce JSON on stdout.

`fix` deletes characters except normalized spaces. Without `--keep-benign`, it changes emoji and Mongolian text by removing joiners/selectors. Review prose with `check` or `fix --dry-run`; use `reveal` for visible markers.

### `reveal [paths...]`

Prints `revealInvisible` output without modifying files; preserves newlines. Multiple inputs use `==> path <==` headers. No options; input errors exit 2.

```sh
npx text-sanctifier reveal AGENTS.md
git diff | npx text-sanctifier reveal
```

### Inputs

- Paths can be files, directories or globs (`*`, `**`, `?`, `[...]`, `{a,b}`). Quote globs so the shell passes them through.
- Directories/globs use `git ls-files`, respecting `.gitignore`. Outside git, skip `.git` and `node_modules`. Explicit files are read unless excluded.
- `--exclude GLOB`: relative paths or parents; ignore leading `./` and trailing `/`. `*` cannot cross `/`: `*.tar` matches top-level, `**/*.tar` any depth. JSON/SARIF list exclusions; text summaries count them. Never excludes stdin. No config, ignore file or inline suppression; scanned text cannot silence checks.
- Binary files are skipped and reported in summaries and JSON `skipped`; AI scans also skip known binary signatures and image, font and archive extensions. See [detection heuristic](DESIGN.md#working-in-this-repo).
- UTF-16 files with a BOM are decoded and checked. `fix` never rewrites them and lists them under `skipped`.
- Invalid UTF-8 is checked with invalid bytes decoded as U+FFFD; `check` reports stderr warnings and JSON `notUtf8`. `fix` refuses rewriting and lists `skipped`.
- `-` reads stdin. With no paths, `check` reads piped input, and scans the current directory when stdin is a terminal, the null device or empty. `check --ai-config` always searches the current directory with no paths. `fix` and `reveal` read piped input. `fix` writes the cleaned text to stdout and the report to stderr.
- No matching files or nothing checked exits 2, as does `fix` refusing stdin/explicit files. Excluding every matched input exits 0. Directory/glob skips do not fail if another input is checked.
- JSON `errors`: `{ path, code, message, cause? }`; `path` may be null, system `cause` appears on read/write failures. Codes: `usage`, `not_found`, `no_match`, `read_failed`, `decode_failed`, `write_failed`, `refused`, `nothing_checked`. Nonempty errors mean exit 2.

### Exit codes

| Code | `check` | `fix` | `reveal` |
| --- | --- | --- | --- |
| 0 | nothing found | done (or nothing to do) | done |
| 1 | findings | `--dry-run` with changes pending | not used |
| 2 | usage error, missing or unreadable input, a path matching no files, or nothing checked (except all-excluded or empty AI scans) | same, or an input you named that it refused to rewrite | same as `check` |

---

## Notes

Requires ES2020+, Node.js `>=18` or modern evergreen browsers; no runtime dependencies.

- **ESM only:** no CommonJS build; `require('text-sanctifier')` needs Node's `require(esm)` support.
- **Types:** JSDoc source; declarations in `dist/types`.
- **Browser:** `text-sanctifier/browser` resolves to the prebuilt ESM file. With a bundler use `text-sanctifier`: source tree-shakes (`sideEffects: false`), prebuilt file does not. Per-import budgets are checked; `inspectTextDetailed` is about <!-- gen:size:inspectTextDetailed -->0.9 KiB<!-- /gen --> gzipped.

---

## License

Licensed under AGPL-3.0 with WATT3D Additional Terms. See [LICENSE](./LICENSE) and [ADDITIONAL_TERMS.md](./ADDITIONAL_TERMS.md). Commercial AI/model-training use requires compliance with those terms or a separate WATT3D license. © WATT3D.
