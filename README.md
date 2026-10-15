# text-sanctifier

[![npm](https://img.shields.io/npm/v/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![downloads](https://img.shields.io/npm/dm/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![bundle size](https://img.shields.io/bundlephobia/minzip/text-sanctifier)](https://bundlephobia.com/package/text-sanctifier)
[![license](https://img.shields.io/npm/l/text-sanctifier)](https://github.com/iWhatty/text-sanctifier/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/iWhatty/text-sanctifier?style=social)](https://github.com/iWhatty/text-sanctifier)
[![types](https://img.shields.io/npm/types/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)

Brutal text normalizer and invisible Unicode scrubber for modern web projects. ~2.44 KB gzipped.

## Features

- Purges zero-width Unicode garbage
- Purges bidi controls, including the isolates (U+2066–U+2069) and the Arabic letter mark (U+061C) used in Trojan Source attacks
- Purges Unicode tag characters (U+E0000–U+E007F), the "ASCII smuggling" channel for hiding instructions from humans in text an LLM reads, plus variation selectors, Hangul fillers, soft hyphens and invisible operators
- Locates invisible and control characters by offset, line and column (`inspectTextDetailed`)
- `text-sanctifier check` / `fix` command line for CI and coding agents, with JSON output and exit codes
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

### `summonSanctifier.strict`

Aggressively purges: emojis, control characters, extra spacing, and newlines.

### `summonSanctifier.loose`

Gently normalizes spacing and newlines while preserving emojis and paragraphs.

### `summonSanctifier.keyboardOnly`

Restricts to printable ASCII only (removes emojis).

### `summonSanctifier.keyboardOnlyEmoji`

Restricts to printable ASCII + full emoji sequences. Preserves ZWJ emoji clusters and emoji presentation variants.

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
| `invisible_format` | U+00AD (soft hyphen), U+034F (combining grapheme joiner), U+180E (Mongolian vowel separator), U+2061–U+2064 (invisible operators) | `purgeInvisibleChars` |
| `hangul_filler` | U+115F, U+1160, U+3164, U+FFA0 (letters that render blank) | `purgeInvisibleChars` |
| `variation_selector` | U+FE00–U+FE0F (VS1-VS16, including VS16 in emoji), U+E0100–U+E01EF (VS17-VS256) | `purgeInvisibleChars` |
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

`zero_width` also flags U+200D (zero width joiner) inside emoji ZWJ sequences such as 👨‍👩‍👧, so a finding there is not necessarily hidden text. Filter by neighbouring code points if you need to tell them apart. (`purgeInvisibleChars` removes those joiners too, splitting the emoji; `keyboardOnlyEmoji` keeps the sequences whole.) The same holds for `variation_selector`, which flags VS16 (U+FE0F) in emoji such as ✌️ and the ideographic variation selectors in CJK names, and for `tag`, which flags the tag characters inside subdivision flags such as the England flag (U+1F3F4 followed by tags). `purgeInvisibleChars` strips them all; `keyboardOnlyEmoji` keeps VS16.

The categories cover exactly what `nukeControls` and `purgeInvisibleChars` strip.

---

## Command line

The package ships a `text-sanctifier` command for CI and coding agents, which cannot see invisible characters in their own tool output. It runs on Node 18+ and has no dependencies.

```sh
npx text-sanctifier check src docs "**/*.md"
npx text-sanctifier fix --dry-run src
```

### `check [paths...]`

Reports every invisible or control character as `path:line:column  U+XXXX  category`, using the categories of `inspectTextDetailed`:

```
docs/intro.md:12:7  U+200B  zero_width
src/auth.js:40:3  U+202E  bidi_control
2 findings in 2 of 31 files.
```

- `--json`: one JSON object on stdout, `{ files, total, filesScanned, filesWithFindings, skipped }`. Each entry in `files` is `{ path, ...inspectTextDetailed(text) }`; only files with findings are listed.
- `--max-findings N`: findings listed per file (default 100; `all` for no cap). Counts always cover every occurrence.
- `--strip-bom`: also report a BOM at offset 0, which is skipped by default.

### `fix [paths...]`

Rewrites files in place and reports what it removed.

- `--purge-invisible`: `purgeInvisibleChars`
- `--nuke-controls`: `nukeControls`
- `--normalize-newlines`: `normalizeNewlines` (CRLF and CR to LF)
- With none of the three, `fix` uses `--purge-invisible --nuke-controls`, which removes exactly what `check` reports.
- `--strip-bom`: also remove a BOM at offset 0. It is kept by default.
- `--dry-run`: write nothing; report what would change.
- `--json`: `{ files, dryRun, filesScanned, filesChanged, skipped }`, where each file is `{ path, removed, removedTotal, newlinesNormalized }`.

`fix` deletes characters; it does not replace them. A non-breaking space between two words joins them, and emoji lose their zero width joiners and variation selectors. Run `check` or `fix --dry-run` first on prose.

### Inputs

- Paths can be files, directories or globs (`*`, `**`, `?`, `[...]`, `{a,b}`). Quote globs so the shell passes them through.
- Inside a git work tree, directories and globs list files with `git ls-files`, so anything `.gitignore` excludes is skipped. Outside git, `.git` and `node_modules` are skipped. A file named explicitly is always read.
- Binary files (a NUL byte in the first 8000 bytes) and files that are not valid UTF-8 are skipped, and `fix` never writes them. In JSON they appear under `skipped`.
- `-`, or no paths with piped input, reads stdin. `fix` writes the cleaned text to stdout and the report to stderr.

### Exit codes

| Code | `check` | `fix` |
| --- | --- | --- |
| 0 | nothing found | done (or nothing to do) |
| 1 | findings | `--dry-run` with changes pending |
| 2 | usage error, missing path or unreadable file | same |

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
