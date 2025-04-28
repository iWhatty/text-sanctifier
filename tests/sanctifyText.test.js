// tests/sanctifyText.test.js

import { sanctifyText, summonSanctifier } from '../src/index.js';

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ ${message}\n  Expected: "${expected}"\n  Received: "${actual}"`);
    process.exitCode = 1; // Mark test run as failed
  } else {
    console.log(`✅ ${message}`);
  }
}

// --- Tests ---

console.log('Running text-sanctifier tests...');

// 1. Basic invisible character purge
assertEqual(
  sanctifyText('Hello\u200BWorld'),
  'HelloWorld',
  '1. Purge zero-width space'
);

// 2. Normalize CRLF line endings
assertEqual(
  sanctifyText('Line1\r\nLine2\rLine3'),
  'Line1\nLine2\nLine3',
  '2. Normalize line endings to Unix \\n'
);

// 3. Collapse multiple spaces
assertEqual(
  sanctifyText('Hello   World', { collapseSpaces: true }),
  'Hello World',
  '3. Collapse multiple spaces into one'
);

// 4. Collapse multiple newlines
assertEqual(
  sanctifyText('Line1\n\n\nLine2', { preserveParagraphs: true }),
  'Line1\n\nLine2',
  '4. Preserve paragraph breaks (2 newlines)'
);

// 5. Summoned sanitizer
const aggressiveSanctifier = summonSanctifier({
  preserveParagraphs: false,
  collapseSpaces: true,
  nukeControls: true,
});

assertEqual(
  aggressiveSanctifier('A\t\n\n\u0008B'),
  'A\nB',
  '5. Summoned sanitizer aggressively nukes control chars and collapse newlines'
);


// 6. Double space around newlines should not collapse lines
assertEqual(
  sanctifyText('Line1   \n   Line2'),
  'Line1\nLine2',
  '6. Trim spaces around newlines without collapsing'
);

// 7. Excessive tabs between words should be preserved unless collapseSpaces
assertEqual(
  sanctifyText('Hello\t\tWorld', { collapseSpaces: true }),
  'Hello\t\tWorld',
  '7. Preserve tabs even when collapsing spaces'
);

// 8. Mixed invisible Unicode junk
assertEqual(
  sanctifyText('\u200B\u200C\u200D Hello\u200F\u202DWorld\u202E'),
  'HelloWorld',
  '8. Purge diverse invisible Unicode trash'
);

// 9. Extreme multiple newlines with paragraph preservation
assertEqual(
  sanctifyText('A\n\n\n\n\n\nB', { preserveParagraphs: true }),
  'A\n\nB',
  '9. Collapse 6+ newlines into paragraph break (\\n\\n)'
);

// 10. No collapse when paragraph preservation is off
assertEqual(
  sanctifyText('X\n\nY', { preserveParagraphs: false }),
  'X\nY',
  '10. Collapse double newline to single when not preserving paragraphs'
);

// 11. Ensure no invisible Unicode trash survives
const inputWithGhosts = 'A\u200B\u200C\u200D\u2060\uFEFF\u200E\u200F\u202A\u202E\u00A0B';
const cleaned = sanctifyText(inputWithGhosts);

// Assert that after sanitization:
// - No known trash characters remain
// - Only "AB" is left

assertEqual(
  cleaned,
  'AB',
  '11. Ghostproof: Invisible Unicode characters are fully purged'
);


console.log('All tests finished.');
