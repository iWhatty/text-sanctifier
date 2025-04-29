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

### Basic

```javascript
import { sanctifyText } from 'text-sanctifier';

const cleaned = sanctifyText(rawText, {
  preserveParagraphs: true,
  collapseSpaces: true,
  nukeControls: true,
});
```

### Pre-configured Sanitizers

#### Strict Mode (aggressive cleanup)

```javascript
import { sanctifyText } from 'text-sanctifier';

const strictSanitizer = sanctifyText.strict();
const cleanText = strictSanitizer(rawText);
```

#### Loose Mode (preserve paragraphs)

```javascript
import { sanctifyText } from 'text-sanctifier';

const looseSanitizer = sanctifyText.loose();
const cleanBodyText = looseSanitizer(rawInput);
```

### Custom Summoner

```javascript
import { summonSanctifier } from 'text-sanctifier';

const customSanitizer = summonSanctifier({
  preserveParagraphs: false,
  collapseSpaces: true,
  nukeControls: false,
});

const result = customSanitizer(rawInput);
```

## API

### `sanctifyText(text: string, options?: SanctifyOptions): string`
Manually sanitize a text string with configurable options.

### `sanctifyText.strict(): (text: string) => string`
Create a strict sanitizer preset.

### `sanctifyText.loose(): (text: string) => string`
Create a loose sanitizer preset.

### `summonSanctifier(defaultOptions?: SanctifyOptions): (text: string) => string`
Create a reusable pre-bound sanitizer.

---

## License

--{DR.WATT}--

