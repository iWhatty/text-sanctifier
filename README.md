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

### `summonSanctifier(options?: SanctifyOptions, bitFlag?: number): (text: string) => string`
Creates a sanitizer with options pre-bound or accepts a direct bitFlag.

### `summonSanctifier.strict: (text: string) => string`
Strict sanitizer preset (collapse spaces, collapse all newlines, nuke controls).

### `summonSanctifier.loose: (text: string) => string`
Loose sanitizer preset (preserve paragraph breaks, collapse spaces, skip nuking controls).

---

## License

--{DR.WATT}--
