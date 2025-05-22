// ./tests/sanctifyText.test.js


import { summonSanctifier } from '../src/index.js';

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ ${message}\n  Expected: "${expected}"\n  Received: "${actual}"`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

console.log('Running text-sanctifier tests...');



const defaultSanctifier = summonSanctifier({
  purgeInvisibleChars: true,
  normalizeNewlines: true,
  trimSpacesAroundNewlines: true,
  finalTrim: true,
});


const collapseSpacesSanctifier = summonSanctifier({
  purgeInvisibleChars: true,
  normalizeNewlines: true,
  trimSpacesAroundNewlines: true,
  collapseSpaces: true,
  finalTrim: true,
});


const preserveParagraphsSanctifier = summonSanctifier({
  purgeInvisibleChars: true,
  normalizeNewlines: true,
  trimSpacesAroundNewlines: true,
  collapseNewLines: true,
  preserveParagraphs: true,
  finalTrim: true,
});


const dontPreserveParagraphsSanctifier = summonSanctifier({
  purgeInvisibleChars: true,
  normalizeNewlines: true,
  trimSpacesAroundNewlines: true,
  collapseNewLines: true,
  preserveParagraphs: false,
  finalTrim: true,
});


const aggressiveSanctifier = summonSanctifier.strict;


// 1. Basic invisible character purge
assertEqual(
  defaultSanctifier('Hello\u200BWorld'),
  'HelloWorld',
  '1. Purge zero-width space'
);

// 2. Normalize CRLF line endings
assertEqual(
  defaultSanctifier('Line1\r\nLine2\rLine3'),
  'Line1\nLine2\nLine3',
  '2. Normalize line endings to Unix \\n'
);

// 3. Collapse multiple spaces, collapseSpaces: true
assertEqual(
  collapseSpacesSanctifier('Hello   World'),
  'Hello World',
  '3. Collapse multiple spaces into one'
);

// 4. Collapse multiple newlines (preserve paragraphs), preserveParagraphs: true
assertEqual(
  preserveParagraphsSanctifier('Line1\n\n\nLine2'),
  'Line1\n\nLine2',
  '4. Preserve paragraph breaks (2 newlines)'
);

// 5. Summoned sanitizer
assertEqual(
  aggressiveSanctifier('A\t\n\n\u0008B'),
  'A\nB',
  '5. Summoned sanitizer aggressively nukes control chars and collapse newlines'
);

// 6. Double space around newlines should not collapse lines
assertEqual(
  defaultSanctifier('Line1   \n   Line2'),
  'Line1\nLine2',
  '6. Trim spaces around newlines without collapsing'
);

// 7. Excessive tabs between words should be preserved unless collapseSpaces, collapseSpaces: true
assertEqual(
  collapseSpacesSanctifier('Hello\t\tWorld'),
  'Hello\t\tWorld',
  '7. Preserve tabs even when collapsing spaces'
);

// 8. Mixed invisible Unicode junk
assertEqual(
  defaultSanctifier('\u200B\u200C\u200D Hello\u200F\u202DWorld\u202E'),
  'HelloWorld',
  '8. Purge diverse invisible Unicode trash'
);

// 9. Extreme multiple newlines with paragraph preservation, preserveParagraphs: true
assertEqual(
  preserveParagraphsSanctifier('A\n\n\n\n\n\nB'),
  'A\n\nB',
  '9. Collapse 6+ newlines into paragraph break (\\n\\n)'
);

// 10. No collapse when paragraph preservation is off
assertEqual(
  dontPreserveParagraphsSanctifier('X\n\nY'),
  'X\nY',
  '10. Collapse double newline to single when not preserving paragraphs'
);

// 11. Ensure no invisible Unicode trash survives
const inputWithGhosts = 'A\u200B\u200C\u200D\u2060\uFEFF\u200E\u200F\u202A\u202E\u00A0B';
const cleaned = defaultSanctifier(inputWithGhosts);

assertEqual(
  cleaned,
  'AB',
  '11. Ghostproof: Invisible Unicode characters are fully purged'
);



// 12. Keyboard-onlyEmoji: preserve ASCII + emojis, strip non-keyboard extras
const keyboardEmojiSanctifier = summonSanctifier.keyboardOnlyEmoji;

assertEqual(
  keyboardEmojiSanctifier('Hello — World 😊 👽 𝌆 ‼️'),
  'Hello - World 😊 👽  ‼️',
  '12. keyboardOnlyEmoji: normalize dashes and preserve emojis'
);

// 13. Keyboard-onlyEmoji: normalize smart quotes and dashes
assertEqual(
  keyboardEmojiSanctifier(`“Hello”—‘World’`),
  '"Hello"-\'World\'',
  '13. keyboardOnlyEmoji: normalize smart quotes and dashes'
);

// 14. Keyboard-only strict: purge emojis and normalize symbols
const keyboardStrict = summonSanctifier.keyboardOnly;

assertEqual(
  keyboardStrict('Hi 😊 — “there”! 👋'),
  'Hi - "there"!',
  '14. keyboardOnly: emojis removed, symbols normalized, spaces collapsed'
);

// 15. Keyboard-onlyEmoji: normalize full-width ASCII punctuation
assertEqual(
  keyboardEmojiSanctifier('Ｈｅｌｌｏ！Ｗｏｒｌｄ？'),
  'Hello!World?',
  '15. keyboardOnlyEmoji: full-width punctuation normalized'
);













console.log('All tests finished.');
