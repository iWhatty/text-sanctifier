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

const strictSanitizer = summonSanctifier.strict();
const cleanText = strictSanitizer(rawText);
```

### Loose Mode (preserve paragraphs)

```javascript
import { summonSanctifier } from 'text-sanctifier';

const looseSanitizer = summonSanctifier.loose();
const cleanBodyText = looseSanitizer(rawInput);
```

## API

### `summonSanctifier(options?: SanctifyOptions): (text: string) => string`
Creates a sanitizer with options pre-bound.

### `summonSanctifier.strict(): (text: string) => string`
Returns a strict sanitizer preset.

### `summonSanctifier.loose(): (text: string) => string`
Returns a loose sanitizer preset.

---

## License

--{DR.WATT}--
