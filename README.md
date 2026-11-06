# text-sanctifier

[![npm](https://badgen.net/npm/v/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![downloads](https://badgen.net/npm/dm/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![bundle size](https://badgen.net/static/gzip/under%203%20KiB/green)](https://bundlejs.com/?q=text-sanctifier)
[![license](https://badgen.net/static/license/AGPL-3.0%20%2B%20terms/blue)](https://github.com/iWhatty/text-sanctifier/blob/main/LICENSE)
[![stars](https://badgen.net/github/stars/iWhatty/text-sanctifier)](https://github.com/iWhatty/text-sanctifier)
[![types](https://badgen.net/npm/types/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)

Find and remove invisible Unicode in web input, model-bound text and repositories. The prebuilt browser file stays under <!-- gen:budget:browser -->3 KiB<!-- /gen --> gzipped; bundlers include only the imports you use.

## Features

- **Clean:** presets and options for invisible and control characters, including the bidi controls behind Trojan Source attacks and the tag characters behind "ASCII smuggling" to LLMs, plus look-alike spaces, emoji and newlines.
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
| No build step | `import { sanctifyPasted } from 'text-sanctifier/browser'` (CDN example below) |
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

Two options handle spaces and zero-width characters gently, and both run before the others:

- `normalizeSpaces`: replace look-alike spaces with an ordinary space. These are U+00A0, U+2000–U+200A, U+202F and U+205F: the `nonbreaking_space` category except U+3000, the ordinary space of CJK text. With `purgeInvisibleChars` alone, a non-breaking space between two words is deleted and the words run together; with `normalizeSpaces` as well, they stay apart.
- `purgeZeroWidthSpaces`: remove the zero width space U+200B, the word joiner U+2060 and U+FEFF, and nothing else. Emoji joiners, ZWNJ, variation selectors and bidi marks are kept.

### `SanctifyOptions`

Used by `summonSanctifier(options)`. All boolean options default to `false`. Processing follows table order after the input-length check.

| Option | Behavior |
| --- | --- |
| `normalizeSpaces` | Replace U+00A0, U+2000-U+200A, U+202F and U+205F with ordinary spaces; keep U+3000. |
| `purgeZeroWidthSpaces` | Remove only U+200B, U+2060 and U+FEFF. |
| `purgeInvisibleChars` | Remove characters marked `purgeInvisibleChars` in the category table, including emoji joiners and selectors. |
| `purgeEmojis` | Remove matched emoji sequences. |
| `nukeControls` | Remove NUL, non-whitespace C0 controls, DEL, C1 controls and bidi controls; keep tab, LF and CR. |
| `keyboardOnlyFilter` | Normalize typographic punctuation, then keep printable ASCII, CR/LF and matched emoji sequences; with `purgeEmojis`, keep no emoji. Deletes non-ASCII letters. |
| `normalizeNewlines` | Convert CRLF and CR to LF. |
| `trimSpacesAroundNewlines` | Remove spaces and tabs immediately around LF runs. |
| `collapseNewLines` | Collapse runs of two or more LFs to one, or three or more to two with `preserveParagraphs`. |
| `preserveParagraphs` | Keep double LF breaks when `collapseNewLines` is enabled; otherwise no effect. |
| `collapseSpaces` | Collapse runs of ordinary spaces to one; keep tabs and newlines. |
| `finalTrim` | Apply JavaScript `.trim()` to the result. |
| `maxLength` | Input cap in UTF-16 code units, checked before processing. Default `Infinity`; negative, non-finite or non-number values mean no cap. |
| `onMaxLength` | Default `'throw'`: throw `RangeError` above the cap. `'truncate'`: slice input to at most the cap before processing, never through a surrogate pair. `'noop'`: return original input unchanged. Invalid values use `'throw'`. |

```js
import { summonSanctifier } from 'text-sanctifier';
const clean = summonSanctifier({ purgeInvisibleChars: true, maxLength: 10000, onMaxLength: 'throw' });
```

Every sanitizer replaces unpaired surrogates with U+FFFD before anything else, so removing a character between two halves cannot join them into a new one.

### Errors

All text-processing exports throw `TypeError` on non-string input, including the preset functions, the sanitizer returned by `summonSanctifier`, `findHiddenRuns` and `decodeTagText`. Inputs are not coerced to strings. Sanitizers also throw `RangeError` when input exceeds `maxLength` with `onMaxLength: 'throw'`.

### Presets as standalone imports

Each preset is also its own export: `sanctifyStrict`, `sanctifyLoose`, `sanctifyKeyboardOnly`, `sanctifyKeyboardOnlyEmoji` and `sanctifyPasted`. They are the same functions as `summonSanctifier.strict` and the rest. Import one directly and a bundler leaves out `summonSanctifier` and the other presets (about <!-- gen:size:sanctifyPasted -->1.1 KiB<!-- /gen --> gzipped instead of <!-- gen:size:summonSanctifier.pasted -->1.5 KiB<!-- /gen -->).

```js
import { sanctifyPasted } from 'text-sanctifier';

const output = sanctifyPasted(clipboardText);
```

### `summonSanctifier.strict`

Purges invisible characters, emoji and non-whitespace controls. Normalizes CRLF and CR to LF, removes spaces/tabs around LF, collapses blank lines to a single LF, collapses ordinary spaces and trims the ends. Single line breaks remain.

### `summonSanctifier.loose`

Normalizes spacing and newlines while preserving emoji and paragraph breaks (LF runs collapse to at most two). Keeps zero-width characters such as U+200B, U+200C, U+200D and U+2060; it does not enable `purgeInvisibleChars`.

### `summonSanctifier.keyboardOnly`

Normalizes typographic punctuation, then keeps printable ASCII and line breaks; removes emoji and non-ASCII letters.

### `summonSanctifier.keyboardOnlyEmoji`

Normalizes typographic punctuation, then keeps printable ASCII, line breaks and matched emoji sequences, including ZWJ clusters and emoji presentation variants. Both keyboard-only presets delete non-ASCII letters: `sanctifyKeyboardOnlyEmoji('caf\u00E9')` returns `'caf'`, not an ASCII transliteration.

### `summonSanctifier.pasted`

For text pasted from documents, chat apps and PDFs, and for model output. Some models put narrow no-break spaces (U+202F) and other look-alike spaces into their answers. This preset uses `normalizeSpaces`, `purgeZeroWidthSpaces` and `normalizeNewlines`: look-alike spaces become ordinary spaces, zero-width spaces and word joiners are removed, and CRLF and CR become LF. It keeps emoji joiners, variation selectors, bidi marks, indentation, blank lines and leading and trailing whitespace, so it is safe on code and Markdown.

### `revealInvisible(text: string, options?: RevealOptions): string`

Replaces every character `inspectTextDetailed` would report with a visible marker and leaves everything else alone, including tabs, newlines and emoji. Use it to show hidden text in logs, diffs, review tools and agent tool output. Also in the browser build.

```js
import { revealInvisible } from 'text-sanctifier';

revealInvisible('a\u200Bb\u{E0041}');                    // 'a<U+200B>b<U+E0041>'
revealInvisible('a\u202Eb', { format: (codePoint, category) => `[${category}]` }); // 'a[bidi_control]b'
```

The default marker is `<U+XXXX>` with at least four uppercase hex digits. Every hidden character is replaced, with no cap like `maxFindings`. A literal `<U+200B>` already in the text looks the same as a marker; pass `format` to choose markers that can't occur in your input.

### `inspectText(text: string): UnicodeTrashReport`

Returns a structural report of control codes, invisible chars, newline styles, and more.

```js
import { inspectText } from 'text-sanctifier';

const report = inspectText(input);

/*
{
  hasControlChars: true,
  hasInvisibleChars: true,
  hasMixedNewlines: false,
  newlineStyle: 'LF',
  hasEmojis: true,
  hasNonKeyboardChars: false,
  summary: [
    'Control characters detected.',
    'Invisible Unicode characters detected.',
    'Emojis detected.',
    'Consistent newline style: LF'
  ]
}
*/
```

Use `inspectText` to preflight text content before rendering, storing, or linting. It's a diagnostic tool to help inform sanitization needs. Pass the report to `getRecommendedSanctifierOptions(report)` to auto-generate config flags for `summonSanctifier()`. It turns on what removes trash without losing meaning; `purgeEmojis` and `keyboardOnlyFilter` delete content, so you opt in to those yourself.

### `inspectTextDetailed(text: string, options?: { maxFindings?: number }): DetailedTrashReport`

Returns each invisible or control character with its offset, line, column, code point and category, plus per-category counts and a `truncated` flag. Also exported from the browser build (`text-sanctifier/browser`). `inspectText`'s output is unchanged.

```js
import { inspectTextDetailed } from 'text-sanctifier';

const { findings, counts, total, truncated } = inspectTextDetailed(input, { maxFindings: 100 });

/*
findings: [
  { offset: 0, line: 1, column: 1, codePoint: 0xFEFF, category: 'bom', atStart: true },
  { offset: 42, line: 3, column: 7, codePoint: 0x2067, category: 'bidi_control' },
]
counts: { bidi_control: 1, zero_width: 0, nonbreaking_space: 0, bom: 1, nul: 0, c0_control: 0, c1_control: 0,
          invisible_format: 0, hangul_filler: 0, variation_selector: 0, tag: 0 }
total: 2
truncated: false
*/
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

`zero_width` also flags U+200D (zero width joiner) inside emoji ZWJ sequences such as U+1F468 U+200D U+1F469 U+200D U+1F467, so a finding there is not necessarily hidden text. Use [`text-sanctifier/context`](#text-sanctifiercontext-inspecttextincontexttext-options) to mark supported legitimate sequences as benign. (`purgeInvisibleChars` removes those joiners too, splitting the emoji; `keyboardOnlyEmoji` keeps the sequences whole.) The same holds for `variation_selector`, which flags VS16 (U+FE0F) in emoji such as U+270C U+FE0F and the ideographic variation selectors in CJK names, and for `tag`, which flags the tag characters inside subdivision flags such as the England flag (U+1F3F4 followed by tags). `purgeInvisibleChars` strips them all; `keyboardOnlyEmoji` keeps VS16. The Mongolian free variation selectors (U+180B–U+180D, U+180F) are also `variation_selector`: they are legitimate in Mongolian text, which `purgeInvisibleChars` can change, so don't purge Mongolian text with it.

The categories cover exactly what `nukeControls` and `purgeInvisibleChars` strip. Every code point with the Unicode property Default_Ignorable_Code_Point (characters renderers must draw as nothing) is in a category, and a test checks this against the running Node's Unicode data.

`codePoint` is the full code point, so a tag character reports `0xE0041`, not a surrogate. `offset` is a 0-based UTF-16 index (for a code point above U+FFFF, that of its high surrogate); `line` and `column` are 1-based, with columns in UTF-16 code units and lines ending at LF, CR or CRLF. Every occurrence is counted; only the first `maxFindings` (default 100, `Infinity` for all; invalid values such as negative numbers, fractions, strings, `NaN` or `null` fall back to 100) are listed, and `truncated` says when some were not. The scan is one pass with no regex and no copy of the input.

**Choosing `maxFindings`:** the scan itself uses almost no memory, but every listed finding is an object, so the cost of `maxFindings` grows with the number of findings, not the size of the input. 16 MB of non-breaking spaces is 16.7 million findings. With a cap of 20, it scans in about 80 ms and uses 0.2 MB (`npm run bench` measures it on your machine). With `Infinity`, expect roughly 100–200 bytes per finding: about 1.5 GB for 8 million. On untrusted input, keep a cap. Use `maxFindings: 0` for a counts-only report: it builds no finding objects, and `counts`, `total` and `truncated` stay exact.

### `getNewlineStats(text: string): NewlineStats`

Counts each newline style in one pass, with no regex and no copy: `{ crlf, cr, lf, types, mixed }`. `cr` counts CRs not followed by LF, `lf` counts LFs not preceded by CR, `types` lists the styles present in the order `'CRLF'`, `'CR'`, `'LF'`, and `mixed` is true when there is more than one. Also exported from the browser build.

```js
import { getNewlineStats } from 'text-sanctifier';

getNewlineStats('a\r\nb\n'); // { crlf: 1, cr: 0, lf: 1, types: ['CRLF', 'LF'], mixed: true }
```

### `text-sanctifier/hidden`: `findHiddenRuns(text, options?)` and `decodeTagText(text)`

The run finder behind [`check --ai-config`](#ai-configuration-files), for tools that read text on its way to a model. It has no Node APIs, so it works in a browser too, but it is a separate entry point and not part of the `text-sanctifier/browser` bundle.

```js
import { findHiddenRuns, decodeTagText } from 'text-sanctifier/hidden';

const { runs, benign, counts, total, truncated } = findHiddenRuns(text, { maxRuns: 100, maxDecodedLength: 1000 });
// runs:   [{ kind: 'tag', offset, end, line, column, count, decoded: 'Ignore the user', decodedTruncated: false }, ...]
// benign: [[offset, end], ...]  England/Scotland/Wales flags, a lone U+FE0E/U+FE0F after an emoji or in a keycap
// counts: { tag, variation_selector, invisible_operator, reserved_tag_plane }, every run listed or not; total is their sum
```

- `kind` is `tag` (U+E0000–U+E007F), `variation_selector` (U+FE00–U+FE0F, U+E0100–U+E01EF, U+180B–U+180D, U+180F) `invisible_operator` (U+2061–U+2064) or `reserved_tag_plane` (U+E0080–U+E00FF, U+E01F0–U+E0FFF: unassigned, default ignorable, so they render as nothing and can carry data). Consecutive characters of one kind form one run.
- `offset` and `end` are UTF-16 indexes, `[offset, end)`; `count` is in code points. `line` and `column` are counted exactly as in `inspectTextDetailed` (1-based, columns in UTF-16 units, CRLF is one line break). Only tag runs have `decoded` and `decodedTruncated`.
- `sequence` marks a lone selector in a form `text-sanctifier/context` calls benign: `'ideographic'` for U+E0100–U+E01EF after an ideograph, `'mongolian'` for U+180B–U+180D or U+180F after a Mongolian letter. These stay in `runs` because they can carry data, up to a byte per ideograph, so a run with `sequence` is usually ordinary text, but many of them can be a message. U+FE0E and U+FE0F have no such room and go under `benign`.
- `maxRuns` caps the `runs` list and, separately, the `benign` list; `counts`, `total` and `benignTotal` count everything, and `truncated` is true when either list was cut. `maxDecodedLength` caps each `decoded` string in UTF-16 units and never cuts a `<U+XXXX>` marker. Both default to no cap. Only non-negative integers and `Infinity` are valid; invalid values (negative, fractional, a string, `NaN` or `null`) also mean no cap, so set them explicitly for untrusted input. With both set, memory stays flat on any input: on 16 M characters (32 MB) of hidden text the heap grows by under 1 MB, against hundreds of MB with no caps.
- `decodeTagText` turns U+E0020–U+E007E into the ASCII they shadow and writes any other character as `<U+XXXX>`.
- Zero-width, bidi and other invisible characters are not runs; use `inspectTextDetailed` for those.
- `codePointCounts` has the same keys as `counts` and counts the code points in those runs, so long runs weigh more than short ones; `supplementarySelectorCount` counts U+E0100–U+E01EF on their own, apart from the emoji selectors U+FE00–U+FE0F. Both leave out benign spans and stay exact under `maxRuns`.
- `VERSION` is exported here and from the package root: the installed version, as in `package.json`.

### `text-sanctifier/context`: `inspectTextInContext(text, options?)`

`inspectTextDetailed` with context. Some invisible characters are part of ordinary text: the joiners in a family emoji, the selector in ✌ followed by VS16, an ideographic variation selector after a CJK character. This entry point reports the same findings and `counts`, marks each listed finding `benign: true` or `false`, and adds `benignCounts`, exact whether or not a finding is listed. The categories are the same.

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
- the tags of the England, Scotland and Wales flags
- U+200C or U+200D directly after a virama (Devanagari, Bengali, Tamil, Malayalam, Sinhala, Myanmar and the other scripts with one), as IDNA ContextJ (RFC 5892) allows
- U+200C between two Arabic-script letters, skipping marks, as in Persian. This approximates the RFC's joining-type rule: it also accepts a ZWNJ after a letter that does not join to the left, and none in other joining scripts such as Syriac

U+200B, U+2060, U+FEFF, bidi controls and all other tags are never benign, and neither is U+200D between Arabic letters. It needs Unicode property escapes (Node 10+, current browsers), is not in the browser file, and is about <!-- gen:size:text-sanctifier/context -->2.0 KiB<!-- /gen --> gzipped on its own.

`benignSupplementarySelectorCount` counts the benign ideographic selectors U+E0100–U+E01EF. With `findHiddenRuns` from `text-sanctifier/hidden`, `scan.supplementarySelectorCount - report.benignSupplementarySelectorCount` is the exact number of suspicious ones.

---

## Command line

The package ships a `text-sanctifier` command for CI and coding agents, which cannot see invisible characters in their own tool output. It runs on Node 18+ and has no dependencies.

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

- `--json` (or `--format json`): one JSON object on stdout, `{ files, total, filesScanned, filesWithFindings, skipped, excluded, notUtf8, errors }`. Each entry in `files` is `{ path, ...inspectTextDetailed(text) }`; only files with findings are listed. Usage errors also produce JSON on stdout.
- `--exclude GLOB`: exclude matching paths; repeatable. See [Inputs](#inputs). Not available with `--ai-config`.
- `--format sarif`: a [SARIF 2.1.0](https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html) log for code-scanning viewers and editors. See [SARIF output](#sarif-output).
- `--max-findings N`: findings listed per file (default 100; `all` for no cap). Counts always cover every occurrence.
- `--strip-bom`: also report a BOM at offset 0, which is skipped by default.
- `--ai-config`: check agent instruction files for hidden text. See [AI configuration files](#ai-configuration-files).

### AI configuration files

`check --ai-config` looks for hidden instructions in the files coding agents read: rules files, skill files and MCP configuration. Tag characters, variation selectors and invisible operators can carry text that people reviewing the file cannot see but a model reads.

```sh
npx text-sanctifier check --ai-config
```

```
skills/review/SKILL.md:1:17  U+E0049  run of 15 tag characters spelling "Ignore the user"
skills/review/SKILL.md:2:3  U+FE00  run of 3 variation selectors
.cursor/rules/style.mdc:4:9  U+200B  zero_width
19 findings (2 hidden runs) in 2 of 6 AI configuration files.
```

- With no paths it searches the current directory, even when input is piped (so a CI job without stdin still checks the repository); pass `-` to check stdin; directories you name are searched the same way, and files you name are checked whatever they are called. In a git work tree, files `.gitignore` excludes are skipped.
- Files it looks for, matched case-insensitively: `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `AGENT.md`, `GEMINI.md` and `SKILL.md` at any depth; and at the top of the directory, `.claude/**`, `.cursorrules`, `.cursor/rules/**`, `.cursor/mcp.json`, `.windsurfrules`, `.windsurf/rules/**`, `.clinerules` (file or directory), `.roorules`, `.roo/rules/**`, `.github/copilot-instructions.md`, `.github/{instructions,prompts,chatmodes,agents}/**`, `.mcp.json`, `mcp.json` and `.vscode/mcp.json`.
- Consecutive tag characters, variation selectors or invisible operators are reported once, as a run, at the first character. Tag runs are decoded: U+E0020–U+E007E become the ASCII they shadow, and other tags are shown as `<U+XXXX>`.
- Every other invisible or control character is reported as in a plain `check`.
- Two legitimate sequences are left out: the flags of England, Scotland and Wales (U+1F3F4, tag letters, U+E007F), and a single U+FE0E or U+FE0F (text or emoji presentation) after an emoji (`Extended_Pictographic`) or in a keycap such as 1, U+FE0F, U+20E3. After a letter it is reported: one selector per letter can carry a bit of hidden data. A plain `check` still reports both.
- `--json` adds `hiddenRuns` (`{ kind, offset, line, column, codePoint, count, decoded?, decodedTruncated? }`, at most `--max-findings` per file) and `hiddenRunCount` to each file, and `hiddenRunCount` to the summary. `kind` is `tag`, `variation_selector`, `invisible_operator` or `reserved_tag_plane`; `decoded` is cut at 1000 characters. `total` and `counts` leave out the legitimate sequences.

### SARIF output

`check --format sarif` (with or without `--ai-config`) prints one SARIF 2.1.0 log with one result per listed finding:

- `ruleId` is the category, and `tool.driver.rules` lists every category.
- `level`: `error` for `bidi_control` and `tag`, `note` for `nonbreaking_space`, `warning` for the rest.
- Each location has the file (relative to `%SRCROOT%`, the current directory), `startLine`, `startColumn` and `endColumn`. Columns count UTF-16 code units, as in `inspectTextDetailed` (`columnKind: "utf16CodeUnits"`).
- Each result has a `partialFingerprints` hash based on its rule, relative path, line content and occurrence on that line. Adding unrelated lines above does not change it.
- With `--ai-config`, the message of the first result in a run describes the run and its decoded text.
- `--max-findings` caps results per file as usual. `runs[0].properties` holds `total`, `filesScanned`, `filesWithFindings`, `truncated` (files with findings left out), `skipped` and `excluded`.

### pre-commit

The repository publishes a [pre-commit](https://pre-commit.com) hook manifest, so the check runs locally on the files being committed:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/iWhatty/text-sanctifier
    rev: v1.3.12  # a release tag
    hooks:
      - id: text-sanctifier            # every staged text file
      - id: text-sanctifier-ai-config  # agent instruction files, with --ai-config
```

- `text-sanctifier` runs `text-sanctifier check` on staged text files, as pre-commit defines them: it can drop a file with control bytes near its start before the hook sees it, so scan the repository with `check` as well if that matters to you. Use `exclude:` for files that legitimately contain these characters, or `args: [--strip-bom]` and the other `check` options.
- `text-sanctifier-ai-config` runs `text-sanctifier check --ai-config` on staged files that match the `--ai-config` file list.
- A hook fails the commit when it finds something (exit code 1). Neither hook changes files; run `text-sanctifier fix` yourself.

### `fix [paths...]`

Rewrites files in place and reports what it replaced and removed.

- `--normalize-spaces`: `normalizeSpaces` (look-alike spaces become ordinary spaces)
- `--purge-invisible`: `purgeInvisibleChars`
- `--keep-benign`: preserve contextually legitimate joiners, selectors and flag tags when purging invisible characters. Works with the default cleaning flags too.
- `--nuke-controls`: `nukeControls`
- `--normalize-newlines`: `normalizeNewlines` (CRLF and CR to LF)
- With none of these, `fix` uses `--normalize-spaces --purge-invisible --nuke-controls`: look-alike spaces become ordinary spaces, and everything else `check` reports is removed.
- `--strip-bom`: also remove a BOM at offset 0. It is kept by default.
- `--dry-run`: write nothing; report what would change.
- `--exclude GLOB`: exclude matching paths; repeatable. See [Inputs](#inputs).
- `--json` (or `--format json`): `{ files, dryRun, filesScanned, filesChanged, skipped, excluded, errors }`, where each file is `{ path, spacesReplaced, removed, removedTotal, newlinesNormalized }`. Usage errors also produce JSON on stdout.

Apart from look-alike spaces, `fix` deletes characters. By default, emoji lose their zero width joiners and variation selectors, and so does Mongolian text. Use `--keep-benign` to preserve recognized legitimate sequences, or run `check` or `fix --dry-run` first on prose. To make hidden characters visible without changing a file, use `reveal`.

### `reveal [paths...]`

Prints each input with every character `check` would report replaced by a marker such as `<U+200B>` (see `revealInvisible`). Everything else, including newlines, is printed as it is, and files are never changed. Several inputs are printed one after another under `==> path <==` headers. `reveal` takes no options and exits 0 unless an input can't be read.

```sh
npx text-sanctifier reveal AGENTS.md
git diff | npx text-sanctifier reveal
```

### Inputs

- Paths can be files, directories or globs (`*`, `**`, `?`, `[...]`, `{a,b}`). Quote globs so the shell passes them through.
- Inside a git work tree, directories and globs list files with `git ls-files`, so anything `.gitignore` excludes is skipped. Outside git, `.git` and `node_modules` are skipped. A file named explicitly is always read, unless `--exclude` matches it.
- `--exclude GLOB` matches paths relative to the current directory, or any parent directory. Leading `./` and trailing `/` are ignored. `*` does not cross `/`: `*.tar` matches only the top level, while `**/*.tar` matches any depth. Excluded paths are listed in JSON and SARIF and counted in text summaries. Stdin is never excluded. There is no config file, ignore file or inline comment form; scanned text cannot silence the scanner.
- Binary files are skipped, counted in the summary and listed under `skipped` in JSON. A file counts as binary when its first 8000 bytes hold a NUL and more than 5% control bytes, and it is either invalid UTF-8 or entirely ASCII with at least 8 control bytes. Any non-ASCII byte in valid UTF-8 keeps the file checked, even beyond the sample. A stray NUL or bad byte does not hide a text file. Stdin and AI configuration files are never treated as binary. `fix` is more careful, because it rewrites files: in a directory or glob it also skips any file with a NUL in those bytes, and it cleans such a file only if you name it.
- UTF-16 files with a BOM are decoded and checked. `fix` never rewrites them and lists them under `skipped`.
- Files that are not valid UTF-8 are still checked, with each invalid byte read as U+FFFD, so one bad byte cannot hide the rest of the file. `check` notes them on stderr and lists them under `notUtf8` in JSON; `fix` never writes them and lists them under `skipped`.
- `-` reads stdin. With no paths, `check` reads piped input, and scans the current directory when stdin is a terminal, the null device or empty. `check --ai-config` always searches the current directory with no paths. `fix` and `reveal` read piped input. `fix` writes the cleaned text to stdout and the report to stderr.
- A path or glob that matches no files, or a run that checks nothing, exits 2 instead of reporting a clean result. So does `fix` when it refuses stdin or a file you named. Files it skips in a directory or glob don't fail the run.
- JSON `errors` entries have `path` (or null), `code` and `message`; read and write failures may also include a system `cause`. Codes are `usage`, `not_found`, `no_match`, `read_failed`, `decode_failed`, `write_failed`, `refused` and `nothing_checked`. Exit 2 means `errors` is nonempty.

### Exit codes

| Code | `check` | `fix` | `reveal` |
| --- | --- | --- | --- |
| 0 | nothing found | done (or nothing to do) | done |
| 1 | findings | `--dry-run` with changes pending | not used |
| 2 | usage error, missing or unreadable input, a path matching no files, or nothing checked | same, or an input you named that it refused to rewrite | same as `check` |

---

## Notes

### Runtime requirements

Requires a modern JavaScript runtime with ES2020+ support:

- Node.js 18+ (`engines.node >=18`)
- Modern evergreen browsers

### Package and build info

- **Source (`src/`):** ES2020+ ESM modules with JSDoc
- **ESM only:** no CommonJS build; `require('text-sanctifier')` works only on Node versions with `require(esm)` support (20.19+, 22.12+)
- **Types:** TypeScript declarations ship in `dist/types`
- **Browser build (`dist/`):** one minified ESM file with every export, for pages with no build step (`<script type="module">` from a CDN). It is imported as `text-sanctifier/browser`. With a bundler, import `text-sanctifier` instead: the source tree-shakes, and the prebuilt file does not
- **Tree-shake friendly:** ships `sideEffects: false`; `npm run ci` checks the bundled size of each export on its own (for example `inspectTextDetailed` is about <!-- gen:size:inspectTextDetailed -->0.9 KiB<!-- /gen --> gzipped)
- **Zero transpilation:** no built-in polyfills or runtime overhead
- **Bundler ready:** works with Vite, Rollup, Webpack, Parcel, esbuild

---

## License

Licensed under AGPL-3.0 with WATT3D Additional Terms. See [LICENSE](./LICENSE) and [ADDITIONAL_TERMS.md](./ADDITIONAL_TERMS.md). Commercial AI/model-training use requires compliance with those terms or a separate WATT3D license. © WATT3D.
