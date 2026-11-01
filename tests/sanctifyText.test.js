// ./tests/sanctifyText.test.js


import { summonSanctifier, sanctifyStrict, sanctifyLoose, sanctifyKeyboardOnlyEmoji, sanctifyKeyboardOnly, sanctifyPasted } from '../src/index.js';
import { inspectText, inspectTextDetailed, revealInvisible } from '../src/index.js';
import { SPACE_LOOKALIKES_REGEX } from '../src/sanctifyText.js';


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




// 16. inspectText should be stable across multiple calls (global RegExp .test lastIndex bug)
{
  const s = 'A\u200B B'; // contains invisible trash
  const r1 = inspectText(s);
  const r2 = inspectText(s);
  const r3 = inspectText(s);

  assertEqual(r1.hasInvisibleChars, true, '16a. inspectText detects invisible chars (1st call)');
  assertEqual(r2.hasInvisibleChars, true, '16b. inspectText detects invisible chars (2nd call)');
  assertEqual(r3.hasInvisibleChars, true, '16c. inspectText detects invisible chars (3rd call)');
}


// 17. keyboardOnlyEmoji should NOT keep non-emoji junk adjacent to emoji in same non-ASCII run
{
  const keyboardEmojiSanctifier = summonSanctifier.keyboardOnlyEmoji;

  // 𝌆 is non-ASCII and NOT an emoji; adjacent to emoji to form a single non-ASCII run
  const input = 'X😊𝌆Y';
  const out = keyboardEmojiSanctifier(input);

  assertEqual(
    out,
    'X😊Y',
    '17. keyboardOnlyEmoji drops non-emoji non-ASCII even when adjacent to emoji'
  );
}


// 18. Emoji ZWJ sequences should be preserved (keyboardOnlyEmoji)
{
  const keyboardEmojiSanctifier = summonSanctifier.keyboardOnlyEmoji;

  // family emoji is a ZWJ sequence in many renderers
  const input = 'Hi 👨‍👩‍👧‍👦!';
  assertEqual(
    keyboardEmojiSanctifier(input),
    'Hi 👨‍👩‍👧‍👦!',
    '18. Preserve ZWJ emoji sequences'
  );
}


// 19. Variation selector emoji should be preserved (keyboardOnlyEmoji)
{
  const keyboardEmojiSanctifier = summonSanctifier.keyboardOnlyEmoji;

  // "✌️" includes VS16; often tricky
  const input = 'Vibes ✌️ ok';
  assertEqual(
    keyboardEmojiSanctifier(input),
    'Vibes ✌️ ok',
    '19. Preserve VS16 emoji variants'
  );
}


// 20. Default sanitizer does NOT normalize typographic jank unless keyboardOnlyFilter is on
{
  const out = defaultSanctifier('“Hello”—World');
  assertEqual(out, '“Hello”—World', '20. Default does not normalize typographic punctuation');
}



// 21. CR-only newlines normalize then trim around them
assertEqual(
  defaultSanctifier('A  \r   B'),
  'A\nB',
  '21. CR-only newline normalized and surrounding spaces trimmed'
);


// 22. maxLength: throw by default
{
  const s = summonSanctifier({ maxLength: 3 });
  try {
    s('abcd');
    assertEqual('no-throw', 'throw', '22. maxLength throws by default');
  } catch (e) {
    assertEqual(e instanceof RangeError, true, '22. maxLength throws RangeError');
  }
}

// 23. maxLength: truncate
{
  const s = summonSanctifier({ maxLength: 3, onMaxLength: 'truncate', finalTrim: false });
  assertEqual(s('abcd'), 'abc', '23. maxLength truncate');
}

// 24. maxLength: noop returns original
{
  const s = summonSanctifier({ maxLength: 3, onMaxLength: 'noop' });
  assertEqual(s('abcd'), 'abcd', '24. maxLength noop returns original');
}


// 25. Bidi isolates (LRI, RLI, FSI, PDI) and the Arabic letter mark are bidi controls:
//     detected by inspectText and purged by both purge paths (Trojan Source vectors).
{
  const nukeControlsOnly = summonSanctifier({ nukeControls: true });
  const purgeInvisibleOnly = summonSanctifier({ purgeInvisibleChars: true });

  for (const cp of [0x061C, 0x2066, 0x2067, 0x2068, 0x2069]) {
    const hex = 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
    const input = 'A' + String.fromCharCode(cp) + 'B';
    const report = inspectText(input);

    assertEqual(report.hasControlChars, true, `25. inspectText flags ${hex} as a control char`);
    assertEqual(report.hasInvisibleChars, true, `25. inspectText flags ${hex} as an invisible char`);
    assertEqual(nukeControlsOnly(input), 'AB', `25. nukeControls purges ${hex}`);
    assertEqual(purgeInvisibleOnly(input), 'AB', `25. purgeInvisibleChars purges ${hex}`);
  }
}


// 26. Look-alike spaces, zero-width spaces and the pasted preset
{
  const c = (cp) => String.fromCodePoint(cp);
  const NBSP = c(0xA0), NNBSP = c(0x202F), ZWSP = c(0x200B), WJ = c(0x2060), BOM = c(0xFEFF);
  const ZWJ = c(0x200D), ZWNJ = c(0x200C), VS16 = c(0xFE0F), RLM = c(0x200F), IDEO = c(0x3000);
  const family = c(0x1F468) + ZWJ + c(0x1F469);

  const pasted = summonSanctifier.pasted(`Hello${NBSP}world${NNBSP}!${ZWSP}${WJ}${BOM}\r\n  indented\r\nend`);
  assertEqual(pasted, 'Hello world !\n  indented\nend', '26. pasted: look-alike spaces become spaces, zero-width spaces go, CRLF becomes LF, indentation kept');
  assertEqual(
    summonSanctifier.pasted(`${family} ✌${VS16} a${ZWNJ}b ${RLM}x${IDEO}y`),
    `${family} ✌${VS16} a${ZWNJ}b ${RLM}x${IDEO}y`,
    '26. pasted: keeps emoji joiners, VS16, ZWNJ, bidi marks and the ideographic space'
  );

  const purgeOnly = summonSanctifier({ purgeInvisibleChars: true });
  const spaced = summonSanctifier({ purgeInvisibleChars: true, normalizeSpaces: true });
  assertEqual(purgeOnly(`a${NBSP}b`), 'ab', '26. purgeInvisibleChars alone still deletes a NBSP');
  assertEqual(spaced(`a${NBSP}b${ZWSP}c`), 'a bc', '26. normalizeSpaces runs first, so purging keeps the words apart');
  assertEqual(summonSanctifier({ purgeZeroWidthSpaces: true })(`a${ZWSP}b${ZWJ}c${NBSP}`), `ab${ZWJ}c${NBSP}`, '26. purgeZeroWidthSpaces removes only ZWSP, WJ and BOM');
}

// 27. SPACE_LOOKALIKES_REGEX is exactly the nonbreaking_space category minus U+3000
{
  const mismatches = [];
  for (let cp = 0; cp <= 0x10FFFF; cp++) {
    if (cp >= 0xD800 && cp <= 0xDFFF) continue;
    const s = String.fromCodePoint(cp);
    SPACE_LOOKALIKES_REGEX.lastIndex = 0;
    const byRegex = SPACE_LOOKALIKES_REGEX.test(s);
    const f = inspectTextDetailed(s).findings[0];
    const byCategory = !!f && f.category === 'nonbreaking_space' && cp !== 0x3000;
    if (byRegex !== byCategory) mismatches.push(cp.toString(16));
  }
  assertEqual(JSON.stringify(mismatches), '[]', '27. SPACE_LOOKALIKES_REGEX == nonbreaking_space minus U+3000');
}

// 28. revealInvisible
{
  const c = (cp) => String.fromCodePoint(cp);
  const text = `a${c(0x200B)}b\tc\r\n${c(0xE0041)}x${c(0x1F600)}${c(0x1D173)}`;
  assertEqual(revealInvisible(text), 'a<U+200B>b\tc\r\n<U+E0041>x' + c(0x1F600) + '<U+1D173>', '28. revealInvisible: markers for hidden characters, everything else kept');
  assertEqual(revealInvisible('plain text'), 'plain text', '28. revealInvisible: clean text unchanged');
  assertEqual(revealInvisible(''), '', '28. revealInvisible: empty string');
  assertEqual(revealInvisible(c(0xFEFF) + 'x'), '<U+FEFF>x', '28. revealInvisible: a leading BOM is shown');
  assertEqual(revealInvisible(`a${c(0x202E)}b`, { format: (cp, category) => `{${category}:${cp.toString(16)}}` }), 'a{bidi_control:202e}b', '28. revealInvisible: custom format gets code point and category');
  const many = c(0x200B).repeat(250);
  assertEqual(revealInvisible(many), '<U+200B>'.repeat(250), '28. revealInvisible: no maxFindings cap');
  let threw = false;
  try { revealInvisible(42); } catch (e) { threw = e instanceof TypeError; }
  assertEqual(threw, true, '28. revealInvisible: non-string throws TypeError');
}


// 29. Standalone preset exports are the same functions as the summonSanctifier properties
{
  assertEqual(summonSanctifier.strict === sanctifyStrict, true, '29. summonSanctifier.strict is sanctifyStrict');
  assertEqual(summonSanctifier.loose === sanctifyLoose, true, '29. summonSanctifier.loose is sanctifyLoose');
  assertEqual(summonSanctifier.keyboardOnlyEmoji === sanctifyKeyboardOnlyEmoji, true, '29. summonSanctifier.keyboardOnlyEmoji is sanctifyKeyboardOnlyEmoji');
  assertEqual(summonSanctifier.keyboardOnly === sanctifyKeyboardOnly, true, '29. summonSanctifier.keyboardOnly is sanctifyKeyboardOnly');
  assertEqual(summonSanctifier.pasted === sanctifyPasted, true, '29. summonSanctifier.pasted is sanctifyPasted');
  assertEqual(sanctifyPasted('a' + String.fromCharCode(0xA0) + 'b'), 'a b', '29. sanctifyPasted cleans text');
  assertEqual(typeof summonSanctifier({}), 'function', '29. summonSanctifier still builds a sanctifier');
}


console.log('All tests finished.');
