# text-sanctifier

🧹 Brutal text normalizer and invisible trash scrubber for modern web projects.

## Features

- Purges zero-width Unicode garbage
- Normalizes line endings
- Collapses unwanted spaces and paragraphs
- Nukes control characters (if enabled)
- Configurable via options or presets
- Includes strict and loose sanitization modes

## Install

```bash
npm install text-sanctifier
```

## 📦 Package & Build Info

- **Source (`src/`)**: Clean, commented, ES2020+ ESM modules with JSDoc. Designed for modern bundlers and full tree-shaking (no side effects).
- **Browser Bundle (`dist/`)**: Pre-minified ES2020+ module (`text-sanctifier.min.js`, 0.70 KB minified / 0.43 KB gzipped) for direct `<script type="module">` usage.
- **Module Format**: Native ESM (ECMAScript Modules).
- **Bundler Compatibility**: Optimized for Vite, Rollup, Webpack 5+, ESBuild, and Parcel.
- **Transpilation**: The clean source (`src/`) allows you to downlevel during your own build process (e.g., targeting `es2015` if needed).
- **No Transpilers Included**: No built-in shims, polyfills, or transpilation; you control environment compatibility.
- **Tree-shaking Friendly**: Fully optimized with `sideEffects: false` for dead code elimination.
- **Publishing Philosophy**: 
  - Source-first design for flexibility, debuggability, and modern bundling pipelines.
  - Minified bundle included separately for raw browser consumption without a build step.



## Quick Usage

### Basic (via `summonSanctifier`)

```javascript
import { summonSanctifier } from 'text-sanctifier';

const customSanitizer = summonSanctifier({
  preserveParagraphs: true,
  collapseSpaces: true,
  nukeControls: true,
});

const cleaned = customSanitizer(rawText);
```

### Strict Mode (aggressive cleanup)

```javascript
import { summonSanctifier } from 'text-sanctifier';

const strictSanitizer = summonSanctifier.strict;
const cleanText = strictSanitizer(rawText);
```

### Loose Mode (preserve paragraphs)

```javascript
import { summonSanctifier } from 'text-sanctifier';

const looseSanitizer = summonSanctifier.loose;
const cleanBodyText = looseSanitizer(rawInput);
```

## API

### `summonSanctifier(options?: SanctifyOptions): (text: string) => string`
Creates a sanitizer with options pre-bound.

### `summonSanctifier.strict: (text: string) => string`
Strict sanitizer preset (collapse spaces, collapse all newlines, nuke controls).

### `summonSanctifier.loose: (text: string) => string`
Loose sanitizer preset (preserve paragraph breaks, collapse spaces, skip nuking controls).

---

## License

--{DR.WATT}--
