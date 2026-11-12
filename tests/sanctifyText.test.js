// ./tests/sanctifyText.test.js


import { summonSanctifier, sanctifyStrict, sanctifyLoose, sanctifyKeyboardOnlyEmoji, sanctifyKeyboardOnly, sanctifyPasted } from '../src/index.js';
import { inspectText, inspectTextDetailed, revealInvisible, getRecommendedSanctifierOptions } from '../src/index.js';
import { SPACE_LOOKALIKES_REGEX, sanctifyText } from '../src/sanctifyText.js';
import { inspectTextInContext } from '../src/context.js';
import { findHiddenRuns } from '../src/hiddenText.js';

{
  const cp = String.fromCodePoint;
  const purge = summonSanctifier({ purgeEmojis: true });
  for (const component of [cp(0x1F1E8), cp(0x1F1E8, 0xFE0F)]) {
    assertEqual(purge(component), component, 'lone regional indicator preserved by emoji purge');
    assertEqual(sanctifyKeyboardOnlyEmoji(component), '', 'lone regional indicator excluded from keyboard emoji');
    assertEqual(inspectText(component).hasEmojis, false, 'lone regional indicator is not an emoji');
    assertEqual(inspectText(component).hasNonKeyboardChars, true, 'lone regional indicator remains non-keyboard text');
  }
  for (let modifier = 0x1F3FB; modifier <= 0x1F3FF; modifier++) {
    assertEqual(purge('a' + cp(modifier) + 'b'), 'ab', 'lone skin-tone swatch purged');
    assertEqual(sanctifyKeyboardOnlyEmoji(cp(modifier)), cp(modifier), 'lone skin-tone swatch kept as emoji');
    assertEqual(inspectText(cp(modifier)).hasEmojis, true, 'lone skin-tone swatch reported as emoji');
  }
  const oddFlag = cp(0x1F1E8, 0x1F1E6, 0x1F1E8);
  assertEqual(purge(oddFlag), cp(0x1F1E8), 'odd regional indicator remains after purging flag');
  assertEqual(sanctifyKeyboardOnlyEmoji(oddFlag), cp(0x1F1E8, 0x1F1E6), 'keyboard emoji keeps only paired indicators');
  const samples = [cp(0x1F44D, 0x1F3FD), cp(0x1F468, 0x200D, 0x1F469, 0x200D, 0x1F467), cp(0x1F469, 0x1F3FD, 0x200D, 0x1F4BB), cp(0x1F1E8, 0x1F1E6), '1' + cp(0xFE0F, 0x20E3), cp(0x2764, 0xFE0F), cp(0x1F469, 0x200D, 0x2764, 0xFE0F, 0x200D, 0x1F468)];
  for (const emoji of samples) {
    assertEqual(purge('a' + emoji + 'b'), 'ab', 'purge complete emoji');
    assertEqual(sanctifyKeyboardOnlyEmoji('a' + emoji + 'b'), 'a' + emoji + 'b', 'keep complete emoji');
    assertEqual(inspectText(emoji).hasNonKeyboardChars, false, 'emoji is keyboard safe');
  }
  assertEqual(purge(cp(0x1F600, 0x200D) + 'hello world'), cp(0x200D) + 'hello world', 'ZWJ does not consume words');
  assertEqual(purge(cp(0x00A9, 0x2122)), cp(0x00A9, 0x2122), 'plain text pictographs remain');
  assertEqual(purge(cp(0x00A9, 0xFE0F)), '', 'emoji presentation pictograph removed');
  assertEqual(sanctifyKeyboardOnlyEmoji(cp(0x00A9, 0x2122)), '', 'plain pictographs filtered');
  assertEqual(summonSanctifier({ collapseNewLines: true })('a\r\n\rb'), 'a\nb', 'collapse normalizes newlines');
  assertEqual(summonSanctifier({ trimSpacesAroundNewlines: true })('a \r\n b'), 'a\nb', 'trim normalizes newlines');
  for (const clean of [sanctifyStrict, sanctifyKeyboardOnly]) assertEqual(clean('hello' + cp(0xA0) + 'world'), 'hello world', 'strict preserves word separation');
  for (const clean of [sanctifyStrict, sanctifyKeyboardOnly]) assertEqual(clean('a ' + cp(0x2764, 0xFE0F) + ' ' + cp(0xA9, 0xFE0F) + ' b'), 'a b', 'strict removes text-default emoji with their selector');
  assertEqual(summonSanctifier({ purgeInvisibleChars: true })('a' + cp(0x3000) + 'b'), 'a' + cp(0x3000) + 'b', 'ideographic space survives purge');
  assertEqual(sanctifyKeyboardOnlyEmoji('a' + cp(0x3000) + 'b'), 'a b', 'keyboard filter normalizes ideographic space');
  assertEqual(inspectTextDetailed(cp(0x3000)).counts.nonbreaking_space, 1, 'ideographic space remains detected');
}


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
  keyboardEmojiSanctifier('Hello — World 😊 👽 𝌆 ‼\uFE0F'),
  'Hello - World 😊 👽  ‼\uFE0F',
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
  const input = 'Hi 👨\u200D👩\u200D👧\u200D👦!';
  assertEqual(
    keyboardEmojiSanctifier(input),
    'Hi 👨\u200D👩\u200D👧\u200D👦!',
    '18. Preserve ZWJ emoji sequences'
  );
}


// 19. Variation selector emoji should be preserved (keyboardOnlyEmoji)
{
  const keyboardEmojiSanctifier = summonSanctifier.keyboardOnlyEmoji;

  // U+270C U+FE0F includes VS16; often tricky
  const input = 'Vibes ✌\uFE0F ok';
  assertEqual(
    keyboardEmojiSanctifier(input),
    'Vibes ✌\uFE0F ok',
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


// 30. Unpaired surrogates cannot join into a new character when what separates them is removed
{
  const cc = (n) => String.fromCharCode(n);
  const split = (low, filler) => cc(0xDB40) + cc(filler) + cc(low);
  const payload = split(0xDC68, 0x200B) + split(0xDC69, 0x200B);
  const fffd = cc(0xFFFD);
  const strict = sanctifyStrict(payload);
  assertEqual(strict, fffd.repeat(4), '30. strict: split tag halves stay apart');
  assertEqual(sanctifyStrict(strict), strict, '30. strict: idempotent on split halves');
  assertEqual(inspectTextDetailed(strict).counts.tag, 0, '30. strict: no tag characters created');
  assertEqual(inspectTextDetailed(sanctifyPasted(payload)).counts.tag, 0, '30. pasted: no tag characters created');
  assertEqual(inspectTextDetailed(summonSanctifier({ nukeControls: true })(split(0xDC68, 0))).counts.tag, 0, '30. nukeControls: no tag characters created');
  const emoji = String.fromCodePoint(0x1F600);
  assertEqual(sanctifyLoose('a' + emoji + 'b'), 'a' + emoji + 'b', '30. a real surrogate pair is untouched');
}

// 31. Truncation never cuts through a surrogate pair
{
  const emoji = String.fromCodePoint(0x1F600);
  const cut = (n) => summonSanctifier({ maxLength: n, onMaxLength: 'truncate' })(emoji + 'x');
  assertEqual(cut(1), '', '31. a cut through a pair drops the whole character');
  assertEqual(cut(2), emoji, '31. a cut after a pair keeps it');
  assertEqual(cut(0), '', '31. maxLength 0');
  assertEqual(summonSanctifier({ maxLength: 1, onMaxLength: 'truncate' })('abc'), 'a', '31. plain text is cut at the cap');
  let threw = '';
  try { summonSanctifier({ maxLength: 1, onMaxLength: 'bogus' })('abc'); } catch (e) { threw = e.name; }
  assertEqual(threw, 'RangeError', '31. an invalid onMaxLength throws');
  threw = '';
  try { sanctifyText('abc', { maxLength: 1, onMaxLength: 'bogus' }); } catch (e) { threw = e.name; }
  assertEqual(threw, 'RangeError', '31. an invalid onMaxLength throws from sanctifyText too');
}

// 32. Trimming around newlines takes linear time and keeps its meaning
{
  assertEqual(sanctifyLoose('a  \n\t b'), 'a\nb', '32. spaces and tabs around a newline are trimmed');
  assertEqual(summonSanctifier({ trimSpacesAroundNewlines: true })('a  b\t c \n \n d'), 'a  b\t c\n\nd', '32. other runs are kept');
  assertEqual(summonSanctifier({ trimSpacesAroundNewlines: true })('a   '), 'a   ', '32. a trailing run with no newline is kept');
  const started = performance.now();
  for (const clean of [sanctifyLoose, sanctifyStrict, sanctifyKeyboardOnly]) clean(' '.repeat(2_000_000));
  sanctifyStrict('  x'.repeat(700_000));
  assertEqual(performance.now() - started < 5000, true, '32. long runs of spaces take linear time');
}

// 33. Recommended options do not delete content
{
  const recommended = (s) => summonSanctifier(getRecommendedSanctifierOptions(inspectText(s)))(s);
  const cc = (n) => String.fromCharCode(n);
  const russian = cc(0x41F) + cc(0x440) + cc(0x438);
  const emoji = String.fromCodePoint(0x1F600);
  assertEqual(recommended('a\tb'), 'a\tb', '33. a tab is kept');
  assertEqual(recommended('caf' + cc(0xE9) + ' ok'), 'caf' + cc(0xE9) + ' ok', '33. accented letters are kept');
  assertEqual(recommended(russian + cc(0x200B)), russian, '33. non-Latin text is kept, the zero-width space goes');
  assertEqual(recommended(emoji + ' ok'), emoji + ' ok', '33. emoji are kept');
  assertEqual(recommended('a' + cc(0xA0) + 'b'), 'a b', '33. a look-alike space becomes a space');
  assertEqual(recommended('a' + cc(0x7) + 'b'), 'ab', '33. control characters still go');
  assertEqual(recommended('a\r\nb'), 'a\nb', '33. CRLF is still normalized');
}


// 34. Length policies run before sanitizing, and invalid caps leave input uncapped.
{
  const cp = String.fromCodePoint;
  const text = cp(0xD800, 0x200B) + 'abc';
  const options = { purgeInvisibleChars: true, maxLength: 1, onMaxLength: 'noop' };
  assertEqual(summonSanctifier(options)(text), text, '34. noop skips surrogate replacement and purging');
  assertEqual(summonSanctifier({ ...options, maxLength: text.length })(text), cp(0xFFFD) + 'abc', '34. input exactly at the cap is sanitized');
  for (const maxLength of [-1, NaN, Infinity, '1', null]) {
    assertEqual(summonSanctifier({ purgeInvisibleChars: true, maxLength })(text), cp(0xFFFD) + 'abc', '34. invalid or infinite cap does not limit input');
  }
  const emoji = cp(0x1F600);
  assertEqual(summonSanctifier({ maxLength: 2.5, onMaxLength: 'truncate' })('a' + emoji + 'b'), 'a', '34. fractional truncation does not split a surrogate pair');
}

// 35. Emoji removal must see selectors before invisible characters are purged.
{
  const cp = String.fromCodePoint;
  const text = 'a' + cp(0x2764, 0xFE0F) + 'b';
  const clean = summonSanctifier({ purgeEmojis: true, purgeInvisibleChars: true });
  assertEqual(clean(text), 'ab', '35. custom options remove text-default emoji whole');
  assertEqual(clean('a' + cp(0x2764) + 'b'), 'a' + cp(0x2764) + 'b', '35. bare text-default pictograph remains');
  assertEqual(clean('a' + cp(0x1F469, 0x1F3FD, 0x200D, 0x1F4BB) + 'b'), 'ab', '35. custom options remove a joined emoji whole');
}

// Fixed-seed differential coverage for scanners, positions, caps and purging.
{
  let seed = 0x12345678;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  const chars = [0x61, 0x0A, 0x0D, 0xD800, 0xDC00, 0x200B, 0x200D, 0x3000,
    0xFE0F, 0x2061, 0xE0041, 0xE0100, 0x1F600, 0x1F1E8, 0x1F3FD, 0x20E3];
  const purge = summonSanctifier({ purgeInvisibleChars: true, nukeControls: true });
  for (let k = 0; k < 4000; k++) {
    let s = '';
    const length = (next() >>> 16) % 20;
    for (let j = 0; j < length; j++) s += String.fromCodePoint(chars[(next() >>> 16) % chars.length]);
    const all = inspectTextDetailed(s, { maxFindings: Infinity });
    const cap = (next() >>> 16) % 5;
    const limited = inspectTextDetailed(s, { maxFindings: cap });
    const context = inspectTextInContext(s, { maxFindings: cap });
    const runs = findHiddenRuns(s, { maxRuns: Infinity });
    const expectedReveal = all.findings.reduceRight((out, f) =>
      out.slice(0, f.offset) + '<U+' + f.codePoint.toString(16).toUpperCase().padStart(4, '0') + '>' +
      out.slice(f.offset + (f.codePoint > 0xFFFF ? 2 : 1)), s);
    const cleaned = inspectTextDetailed(purge(s), { maxFindings: Infinity });
    if (JSON.stringify(limited.findings) !== JSON.stringify(all.findings.slice(0, cap)) ||
        JSON.stringify(context.findings.map(({ benign, ...f }) => f)) !== JSON.stringify(limited.findings) ||
        JSON.stringify(context.counts) !== JSON.stringify(all.counts) || context.total !== all.total ||
        limited.truncated !== (all.total > cap) || revealInvisible(s) !== expectedReveal ||
        cleaned.findings.some(f => f.codePoint !== 0x3000) ||
        runs.runs.some(r => !all.findings.some(f => f.offset === r.offset && f.line === r.line && f.column === r.column))) {
      throw new Error(`Differential invariant failed at case ${k}: ${JSON.stringify(s)}`);
    }
  }
  assertEqual(true, true, 'fixed-seed scanner and sanitizer invariants');
  const cut = summonSanctifier({ maxLength: 1, onMaxLength: 'truncate' });
  assertEqual(cut('\uD800x'), '\uFFFD', 'truncate retains lone high surrogate before replacement');
}

console.log('All tests finished.');
