# text-sanctifier

[![npm](https://img.shields.io/npm/v/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![gzip size](https://img.shields.io/bundlephobia/minzip/text-sanctifier)](https://bundlephobia.com/package/text-sanctifier)
[![downloads](https://img.shields.io/npm/dw/text-sanctifier)](https://www.npmjs.com/package/text-sanctifier)
[![GitHub stars](https://img.shields.io/github/stars/iWhatty/text-sanctifier?style=social)](https://github.com/iWhatty/text-sanctifier)

Brutal text normalizer and invisible trash scrubber for modern web projects.

* Minified: (2.69 KB)
* Gzipped (GCC): (1.27 KB)

## Features

* Purges zero-width Unicode garbage
* Normalizes line endings (CRLF, CR, LF) → LF
* Collapses unwanted spaces and paragraphs
* Nukes control characters (if enabled)
* Smart normalization of typographic junk (quotes, dashes, bullets, full-width punctuation)
* Keyboard-only filtering (retain printable ASCII + emoji, or restrict)
* Configurable via fine-grained flags or ready-made presets
* Includes strict, loose, and keyboard-only modes

## Install

```bash
npm install text-sanctifier
```

## 📦 Package & Build Info

* **Source (`src/`)**: ES2020+ ESM modules with JSDoc
* **Browser Build (`dist/`)**: Minified ESM bundle for `<script type="module">`
* **Tree-shaking Friendly**: Fully optimized with `sideEffects: false`
* **Zero Transpilation**: No built-in polyfills or runtime overhead
* **Bundler Ready**: Works great with Vite, Rollup, Webpack, Parcel, etc.

---

## 🔧 Quick Usage

### Custom Config

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

### Strict Preset

```js
const output = summonSanctifier.strict(rawText);
```

### Loose Preset

```js
const output = summonSanctifier.loose(rawText);
```

### Keyboard-Only (No Emojis)

```js
const output = summonSanctifier.keyboardOnly(userInput);
```

### Keyboard-Only (With Emojis)

```js
const output = summonSanctifier.keyboardOnlyEmoji(commentText);
```

---

## 🔍 Unicode Trash Detection

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

Use `inspectText` to preflight text content before rendering, storing, or linting. It's a diagnostic tool to help inform sanitization needs.

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

Restricts to keyboard-safe ASCII + emojis. Preserves fun, removes weird.

### `inspectText(text: string): UnicodeTrashReport`

Returns a structural report of control codes, invisible chars, newline styles, and more.

---

## License

\--{DR.WATT v3.0}--
