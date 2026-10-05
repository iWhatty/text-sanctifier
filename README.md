# text-sanctifier

[![npm](https://img.shields.io/npm/v/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![downloads](https://img.shields.io/npm/dm/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![bundle size](https://img.shields.io/bundlephobia/minzip/text-sanctifier)](https://bundlephobia.com/package/text-sanctifier)
[![license](https://img.shields.io/npm/l/text-sanctifier)](https://github.com/iWhatty/text-sanctifier/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/iWhatty/text-sanctifier?style=social)](https://github.com/iWhatty/text-sanctifier)
[![types](https://img.shields.io/npm/types/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)

Brutal text normalizer and invisible Unicode scrubber for modern web projects. ~2.17 KB gzipped.

## Features

- Purges zero-width Unicode garbage
- Purges bidi controls, including the isolates (U+2066–U+2069) and the Arabic letter mark (U+061C) used in Trojan Source attacks
- Locates invisible and control characters by offset, line and column (`inspectTextDetailed`)
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

### Located findings

```js
import { inspectTextDetailed } from 'text-sanctifier';

const { findings, counts, total, truncated } = inspectTextDetailed(input, { maxFindings: 100 });

/*
findings: [
  { offset: 0, line: 1, column: 1, codePoint: 0xFEFF, category: 'bom', atStart: true },
  { offset: 42, line: 3, column: 7, codePoint: 0x2067, category: 'bidi_control' },
]
counts: { bidi_control: 1, zero_width: 0, nonbreaking_space: 0, bom: 1, nul: 0, c0_control: 0, c1_control: 0 }
total: 2
truncated: false
*/
```

| Category | Code points |
| --- | --- |
| `bidi_control` | U+061C, U+200E, U+200F, U+202A–U+202E, U+2066–U+2069 |
| `zero_width` | U+200B–U+200D, U+2060 |
| `nonbreaking_space` | U+00A0, U+2000–U+200A, U+202F, U+3000 (non-breaking and typographic spaces) |
| `bom` | U+FEFF; `atStart` is true at offset 0, where a BOM is legitimate |
| `nul` | U+0000 |
| `c0_control` | U+0001–U+001F except tab, LF and CR; U+007F |
| `c1_control` | U+0080–U+009F |

`offset` is a 0-based UTF-16 index; `line` and `column` are 1-based, with columns in UTF-16 code units and lines ending at LF, CR or CRLF. Every occurrence is counted; only the first `maxFindings` (default 100, `Infinity` for all) are listed, and `truncated` says when some were not. The scan is one pass with no regex and no copy of the input.

---

## Notes

### Runtime requirements

Requires a modern JavaScript runtime with ES2020+ support:

- Node.js 14+
- Modern evergreen browsers

### Package and build info

- **Source (`src/`):** ES2020+ ESM modules with JSDoc
- **Browser build (`dist/`):** Minified ESM bundle for `<script type="module">`
- **Tree-shake friendly:** ships `sideEffects: false`
- **Zero transpilation:** no built-in polyfills or runtime overhead
- **Bundler ready:** works with Vite, Rollup, Webpack, Parcel, esbuild

### `inspectTextDetailed(text: string, options?: { maxFindings?: number }): DetailedTrashReport`

Returns each invisible or control character with its offset, line, column, code point and category, plus per-category counts and a `truncated` flag.

---

## License

Licensed under AGPL-3.0 with WATT3D Additional Terms. See [LICENSE](./LICENSE) and [ADDITIONAL_TERMS.md](./ADDITIONAL_TERMS.md). Commercial AI/model-training use requires compliance with those terms or a separate WATT3D license. © WATT3D.
