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
  'Hello World',
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

console.log('All tests finished.');
