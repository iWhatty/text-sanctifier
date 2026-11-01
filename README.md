# text-sanctifier

[![npm](https://badgen.net/npm/v/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![downloads](https://badgen.net/npm/dm/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![bundle size](https://badgen.net/static/gzip/under%203%20kB/green)](https://bundlejs.com/?q=text-sanctifier)
[![license](https://badgen.net/static/license/AGPL-3.0%20%2B%20terms/blue)](https://github.com/iWhatty/text-sanctifier/blob/main/LICENSE)
[![stars](https://badgen.net/github/stars/iWhatty/text-sanctifier)](https://github.com/iWhatty/text-sanctifier)
[![types](https://badgen.net/npm/types/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)

Brutal text normalizer and invisible Unicode scrubber for modern web projects. ~2.80 KB gzipped.

## Features

- Purges zero-width Unicode garbage
- Purges bidi controls, including the isolates (U+2066–U+2069) and the Arabic letter mark (U+061C) used in Trojan Source attacks
- Purges Unicode tag characters (U+E0000–U+E007F), the "ASCII smuggling" channel for hiding instructions from humans in text an LLM reads, plus variation selectors, Hangul fillers, soft hyphens and invisible operators
- Locates invisible and control characters by offset, line and column (`inspectTextDetailed`)
- Shows hidden characters as visible markers such as `<U+200B>` (`revealInvisible`, `text-sanctifier reveal`)
- Cleans pasted text and model output without gluing words together: look-alike spaces such as the narrow no-break space (U+202F) become ordinary spaces (`summonSanctifier.pasted`)
- `text-sanctifier check` / `fix` command line for CI and coding agents, with JSON or SARIF output, exit codes and pre-commit hooks
- `check --ai-config` finds and decodes hidden text in agent instruction files (`CLAUDE.md`, `AGENTS.md`, Cursor rules, `SKILL.md`, MCP configuration)
- Normalizes line endings (CRLF, CR, LF) to LF
- Collapses unwanted spaces and paragraphs
- Nukes control characters (if enabled)
- Smart normalization of typographic junk (quotes, dashes, bullets, full-width punctuation)
- Keyboard-only filtering (retain printable ASCII + full emoji sequences)
  - Preserves ZWJ emoji clusters (👨‍👩‍👧‍👦)
  - Preserves VS16 emoji presentation variants (✌️, ‼️)
- Configurable via fine-grained flags or ready-made presets
- Includes strict, loose, and keyboard-only modes
- Deterministic RegExp usage (no global `lastIndex` state leaks)

---

## Install

```sh
pnpm add text-sanctifier
```

---

## Quick start

**Custom config:**

```js
import { summonSanctifier } from 'text-sanctifier';

const clean = summonSanctifier({
  purgeInvisibleChars: true,
  purgeEmojis: true,
  collapseSpaces: true,
  collapseNewLines: true,
  preserveParagraphs: true,
  finalTrim: true,
});

const output = clean(rawText);
```

**Strict preset:**

```js
const output = summonSanctifier.strict(rawText);
```

**Loose preset:**

```js
const output = summonSanctifier.loose(rawText);
```

**Keyboard-only (no emojis):**

```js
const output = summonSanctifier.keyboardOnly(userInput);
```

**Keyboard-only (with emojis):**

```js
const output = summonSanctifier.keyboardOnlyEmoji(commentText);
```

**Pasted text and model output:**

```js
const output = summonSanctifier.pasted(clipboardText);
```

**Show what is hidden:**

```js
import { revealInvisible } from 'text-sanctifier';

revealInvisible(text); // 'Hello<U+200B>world'
```

---

## Security notes

- **Not an HTML/XSS sanitizer.** This library normalizes and filters plain text.
- If you need to render **untrusted content**, render it as text (e.g. `textContent`), not HTML (`innerHTML`).
- If you need to sanitize **HTML**, use a dedicated HTML sanitizer (e.g. DOMPurify / sanitize-html).
- Like any text-processing library, extremely large untrusted inputs can be used for CPU/DoS pressure; consider input size limits in high-risk environments.

---

## API

### `summonSanctifier(options?: SanctifyOptions): (text: string) => string`

Creates a reusable sanitizer from an option object.

Two options handle spaces and zero-width characters gently, and both run before the others:

- `normalizeSpaces`: replace look-alike spaces with an ordinary space. These are U+00A0, U+2000–U+200A, U+202F and U+205F: the `nonbreaking_space` category except U+3000, the ordinary space of CJK text. With `purgeInvisibleChars` alone, a non-breaking space between two words is deleted and the words run together; with `normalizeSpaces` as well, they stay apart.
- `purgeZeroWidthSpaces`: remove the zero width space U+200B, the word joiner U+2060 and U+FEFF, and nothing else. Emoji joiners, ZWNJ, variation selectors and bidi marks are kept.

### `summonSanctifier.strict`

Aggressively purges: emojis, control characters, extra spacing, and newlines.

### `summonSanctifier.loose`

Gently normalizes spacing and newlines while preserving emojis and paragraphs.

### `summonSanctifier.keyboardOnly`

Restricts to printable ASCII only (removes emojis).

### `summonSanctifier.keyboardOnlyEmoji`

Restricts to printable ASCII + full emoji sequences. Preserves ZWJ emoji clusters and emoji presentation variants.

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

Use `inspectText` to preflight text content before rendering, storing, or linting. It's a diagnostic tool to help inform sanitization needs. Pass the report to `getRecommendedSanctifierOptions(report)` to auto-generate config flags for `summonSanctifier()`.

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

`codePoint` is the full code point, so a tag character reports `0xE0041`, not a surrogate. `offset` is a 0-based UTF-16 index (for a code point above U+FFFF, that of its high surrogate); `line` and `column` are 1-based, with columns in UTF-16 code units and lines ending at LF, CR or CRLF. Every occurrence is counted; only the first `maxFindings` (default 100, `Infinity` for all) are listed, and `truncated` says when some were not. The scan is one pass with no regex and no copy of the input.

**Choosing `maxFindings`:** the scan itself uses almost no memory, but every listed finding is an object, so the cost of `maxFindings` grows with the number of findings, not the size of the input. 16 MB of non-breaking spaces is 16.7 million findings. With a cap of 20, it scans in about 80 ms and uses 0.2 MB. With `Infinity`, expect roughly 100–200 bytes per finding: about 1.5 GB for 8 million. On untrusted input, keep a cap. Use `maxFindings: 0` for a counts-only report: it builds no finding objects, and `counts`, `total` and `truncated` stay exact.

### `getNewlineStats(text: string): NewlineStats`

Counts each newline style in one pass, with no regex and no copy: `{ crlf, cr, lf, types, mixed }`. `cr` counts CRs not followed by LF, `lf` counts LFs not preceded by CR, `types` lists the styles present in the order `'CRLF'`, `'CR'`, `'LF'`, and `mixed` is true when there is more than one. Also exported from the browser build.

```js
import { getNewlineStats } from 'text-sanctifier';

getNewlineStats('a\r\nb\n'); // { crlf: 1, cr: 0, lf: 1, types: ['CRLF', 'LF'], mixed: true }
```

`zero_width` also flags U+200D (zero width joiner) inside emoji ZWJ sequences such as 👨‍👩‍👧, so a finding there is not necessarily hidden text. Filter by neighbouring code points if you need to tell them apart. (`purgeInvisibleChars` removes those joiners too, splitting the emoji; `keyboardOnlyEmoji` keeps the sequences whole.) The same holds for `variation_selector`, which flags VS16 (U+FE0F) in emoji such as ✌️ and the ideographic variation selectors in CJK names, and for `tag`, which flags the tag characters inside subdivision flags such as the England flag (U+1F3F4 followed by tags). `purgeInvisibleChars` strips them all; `keyboardOnlyEmoji` keeps VS16. The Mongolian free variation selectors (U+180B–U+180D, U+180F) are also `variation_selector`: they are legitimate in Mongolian text, which `purgeInvisibleChars` can change, so don't purge Mongolian text with it.

The categories cover exactly what `nukeControls` and `purgeInvisibleChars` strip. Every code point with the Unicode property Default_Ignorable_Code_Point (characters renderers must draw as nothing) is in a category, and a test checks this against the running Node's Unicode data.

### `text-sanctifier/hidden`: `findHiddenRuns(text)` and `decodeTagText(text)`

The run finder behind [`check --ai-config`](#ai-configuration-files), for tools that read text on its way to a model. It has no Node APIs, so it works in a browser too, but it is a separate entry point and not part of the `text-sanctifier/browser` bundle.

```js
import { findHiddenRuns, decodeTagText } from 'text-sanctifier/hidden';

const { runs, benign } = findHiddenRuns(text);
// runs:   [{ kind: 'tag', offset, end, count, decoded: 'Ignore the user' }, ...]
// benign: [[offset, end], ...]  England/Scotland/Wales flags, a lone U+FE0E/U+FE0F after a character
```

- `kind` is `tag` (U+E0000–U+E007F), `variation_selector` (U+FE00–U+FE0F, U+E0100–U+E01EF, U+180B–U+180D, U+180F) or `invisible_operator` (U+2061–U+2064). Consecutive characters of one kind form one run.
- `offset` and `end` are UTF-16 indexes, `[offset, end)`; `count` is in code points. Only tag runs have `decoded`.
- `decodeTagText` turns U+E0020–U+E007E into the ASCII they shadow and writes any other character as `<U+XXXX>`.
- Zero-width, bidi and other invisible characters are not runs; use `inspectTextDetailed` for those.

---

## Command line

The package ships a `text-sanctifier` command for CI and coding agents, which cannot see invisible characters in their own tool output. It runs on Node 18+ and has no dependencies.

```sh
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

- `--json` (or `--format json`): one JSON object on stdout, `{ files, total, filesScanned, filesWithFindings, skipped }`. Each entry in `files` is `{ path, ...inspectTextDetailed(text) }`; only files with findings are listed.
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

- With no paths it searches the current directory; directories you name are searched the same way, and files you name are checked whatever they are called. In a git work tree, files `.gitignore` excludes are skipped.
- Files it looks for, matched case-insensitively: `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md`, `AGENT.md`, `GEMINI.md` and `SKILL.md` at any depth; and at the top of the directory, `.claude/**`, `.cursorrules`, `.cursor/rules/**`, `.cursor/mcp.json`, `.windsurfrules`, `.windsurf/rules/**`, `.clinerules` (file or directory), `.roorules`, `.roo/rules/**`, `.github/copilot-instructions.md`, `.github/{instructions,prompts,chatmodes,agents}/**`, `.mcp.json`, `mcp.json` and `.vscode/mcp.json`.
- Consecutive tag characters, variation selectors or invisible operators are reported once, as a run, at the first character. Tag runs are decoded: U+E0020–U+E007E become the ASCII they shadow, and other tags are shown as `<U+XXXX>`.
- Every other invisible or control character is reported as in a plain `check`.
- Two legitimate sequences are left out: the flags of England, Scotland and Wales (U+1F3F4, tag letters, U+E007F), and a single U+FE0E or U+FE0F after another character (text or emoji presentation). A plain `check` still reports both.
- `--json` adds `hiddenRuns` (`{ kind, offset, line, column, codePoint, count, decoded?, decodedTruncated? }`, at most `--max-findings` per file) and `hiddenRunCount` to each file, and `hiddenRunCount` to the summary. `kind` is `tag`, `variation_selector` or `invisible_operator`; `decoded` is cut at 1000 characters. `total` and `counts` leave out the legitimate sequences.

### SARIF output

`check --format sarif` (with or without `--ai-config`) prints one SARIF 2.1.0 log with one result per listed finding:

- `ruleId` is the category, and `tool.driver.rules` lists every category.
- `level`: `error` for `bidi_control` and `tag`, `note` for `nonbreaking_space`, `warning` for the rest.
- Each location has the file (relative to `%SRCROOT%`, the current directory), `startLine`, `startColumn` and `endColumn`. Columns count UTF-16 code units, as in `inspectTextDetailed` (`columnKind: "utf16CodeUnits"`).
- With `--ai-config`, the message of the first result in a run describes the run and its decoded text.
- `--max-findings` caps results per file as usual. `runs[0].properties` holds `total`, `filesScanned`, `filesWithFindings`, `truncated` (files with findings left out) and `skipped`.

### pre-commit

The repository publishes a [pre-commit](https://pre-commit.com) hook manifest, so the check runs locally on the files being committed:

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/iWhatty/text-sanctifier
    rev: v1.3.4  # a release tag
    hooks:
      - id: text-sanctifier            # every staged text file
      - id: text-sanctifier-ai-config  # agent instruction files, with --ai-config
```

- `text-sanctifier` runs `text-sanctifier check` on staged text files. Use `exclude:` for files that legitimately contain these characters, or `args: [--strip-bom]` and the other `check` options.
- `text-sanctifier-ai-config` runs `text-sanctifier check --ai-config` on staged files that match the `--ai-config` file list.
- A hook fails the commit when it finds something (exit code 1). Neither hook changes files; run `text-sanctifier fix` yourself.

### `fix [paths...]`

Rewrites files in place and reports what it replaced and removed.

- `--normalize-spaces`: `normalizeSpaces` (look-alike spaces become ordinary spaces)
- `--purge-invisible`: `purgeInvisibleChars`
- `--nuke-controls`: `nukeControls`
- `--normalize-newlines`: `normalizeNewlines` (CRLF and CR to LF)
- With none of these, `fix` uses `--normalize-spaces --purge-invisible --nuke-controls`: look-alike spaces become ordinary spaces, and everything else `check` reports is removed.
- `--strip-bom`: also remove a BOM at offset 0. It is kept by default.
- `--dry-run`: write nothing; report what would change.
- `--json` (or `--format json`): `{ files, dryRun, filesScanned, filesChanged, skipped }`, where each file is `{ path, spacesReplaced, removed, removedTotal, newlinesNormalized }`.

Apart from look-alike spaces, `fix` deletes characters. Emoji lose their zero width joiners and variation selectors, and so does Mongolian text. Run `check` or `fix --dry-run` first on prose. To make hidden characters visible without changing a file, use `reveal`.

### `reveal [paths...]`

Prints each input with every character `check` would report replaced by a marker such as `<U+200B>` (see `revealInvisible`). Everything else, including newlines, is printed as it is, and files are never changed. Several inputs are printed one after another under `==> path <==` headers. `reveal` takes no options and exits 0 unless an input can't be read.

```sh
npx text-sanctifier reveal AGENTS.md
git diff | npx text-sanctifier reveal
```

### Inputs

- Paths can be files, directories or globs (`*`, `**`, `?`, `[...]`, `{a,b}`). Quote globs so the shell passes them through.
- Inside a git work tree, directories and globs list files with `git ls-files`, so anything `.gitignore` excludes is skipped. Outside git, `.git` and `node_modules` are skipped. A file named explicitly is always read.
- Binary files (a NUL byte in the first 8000 bytes) and files that are not valid UTF-8 are skipped, and `fix` never writes them. In JSON they appear under `skipped`.
- `-`, or no paths with piped input, reads stdin. `fix` writes the cleaned text to stdout and the report to stderr.

### Exit codes

| Code | `check` | `fix` | `reveal` |
| --- | --- | --- | --- |
| 0 | nothing found | done (or nothing to do) | done |
| 1 | findings | `--dry-run` with changes pending | not used |
| 2 | usage error, missing path or unreadable file | same | same |

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
- **Browser build (`dist/`):** Minified ESM bundle for `<script type="module">`
- **Tree-shake friendly:** ships `sideEffects: false`
- **Zero transpilation:** no built-in polyfills or runtime overhead
- **Bundler ready:** works with Vite, Rollup, Webpack, Parcel, esbuild

---

## License

Licensed under AGPL-3.0 with WATT3D Additional Terms. See [LICENSE](./LICENSE) and [ADDITIONAL_TERMS.md](./ADDITIONAL_TERMS.md). Commercial AI/model-training use requires compliance with those terms or a separate WATT3D license. © WATT3D.
