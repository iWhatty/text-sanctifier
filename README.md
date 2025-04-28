# text-sanctifier

🧹 Brutal text normalizer and invisible trash scrubber for modern web projects.

## Features

- Purges zero-width Unicode garbage
- Normalizes line endings
- Collapses unwanted spaces and paragraphs
- Nukes control characters (if enabled)
- Configurable by options

## Install

```bash
npm install text-sanctifier
```

## Usage
```JS
import { sanctifyText, summonSanctifier } from 'text-sanctifier';

const cleaned = sanctifyText(rawText, {
  preserveParagraphs: true,
  collapseSpaces: true,
  nukeControls: true,
});

// or create a pre-configured cleaner
const cleanBodyText = summonSanctifier({ preserveParagraphs: true });
const sanitized = cleanBodyText(rawInput);
```

## License
--{DR.WATT}--