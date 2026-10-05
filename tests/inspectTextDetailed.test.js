// ./tests/inspectTextDetailed.test.js
//
// Characters are built with String.fromCharCode so this file holds no raw
// invisible characters and no escape sequences.

import { inspectText, inspectTextDetailed } from '../src/index.js';
import { getNewlineStats } from '../src/inspectText.js';
import { CONTROL_CHARS_REGEX, INVISIBLE_TRASH_REGEX } from '../src/sanctifyText.js';


function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ ${message}\n  Expected: "${expected}"\n  Received: "${actual}"`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

function assertJson(actual, expected, message) {
  assertEqual(JSON.stringify(actual), JSON.stringify(expected), message);
}

const ch = (cp) => String.fromCharCode(cp);
const hex = (cp) => 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, k) => from + k);
const CR = ch(0x0D);
const LF = ch(0x0A);
const TAB = ch(0x09);

console.log('Running inspectTextDetailed tests...');


// 1. Every code point of every category is found, located and categorized.
const CATEGORY_CODE_POINTS = {
  bidi_control: [0x061C, 0x200E, 0x200F, ...range(0x202A, 0x202E), ...range(0x2066, 0x2069)],
  zero_width: [...range(0x200B, 0x200D), 0x2060],
  nonbreaking_space: [0x00A0, ...range(0x2000, 0x200A), 0x202F, 0x3000],
  bom: [0xFEFF],
  nul: [0x0000],
  c0_control: [...range(0x01, 0x08), 0x0B, 0x0C, ...range(0x0E, 0x1F), 0x7F],
  c1_control: range(0x80, 0x9F),
};

for (const [category, codePoints] of Object.entries(CATEGORY_CODE_POINTS)) {
  for (const cp of codePoints) {
    const r = inspectTextDetailed('ab' + ch(cp) + 'c');
    const f = r.findings[0];
    const ok =
      r.findings.length === 1 &&
      f.offset === 2 &&
      f.line === 1 &&
      f.column === 3 &&
      f.codePoint === cp &&
      f.category === category &&
      r.counts[category] === 1 &&
      r.total === 1 &&
      r.truncated === false;
    if (!ok) assertJson(r, { category, codePoint: cp, offset: 2 }, `1. ${hex(cp)} located as ${category}`);
  }
  assertEqual(true, true, `1. all ${codePoints.length} ${category} code points located and categorized`);
}


// 2. The categories cover exactly what the purge regexes match, across the BMP.
{
  const mismatches = [];
  for (let cp = 0; cp <= 0xFFFF; cp++) {
    if (cp >= 0xD800 && cp <= 0xDFFF) continue; // lone surrogates
    const s = ch(cp);
    CONTROL_CHARS_REGEX.lastIndex = 0;
    INVISIBLE_TRASH_REGEX.lastIndex = 0;
    const byRegex = CONTROL_CHARS_REGEX.test(s) || INVISIBLE_TRASH_REGEX.test(s);
    const byDetailed = inspectTextDetailed(s).total === 1;
    if (byRegex !== byDetailed) mismatches.push(hex(cp));
  }
  assertJson(mismatches, [], '2. detailed categories == CONTROL_CHARS_REGEX ∪ INVISIBLE_TRASH_REGEX over the BMP');
}


// 3. Whitespace and ordinary Unicode are not findings.
{
  const r = inspectTextDetailed('a' + TAB + 'b' + LF + 'c' + CR + LF + 'd' + CR + 'e ' + ch(0xE9) + ch(0x2014) + '😊𝌆');
  assertEqual(r.total, 0, '3. tab, CR, LF, space, é, em dash and emoji are not findings');
  assertJson(
    r.counts,
    { bidi_control: 0, zero_width: 0, nonbreaking_space: 0, bom: 0, nul: 0, c0_control: 0, c1_control: 0 },
    '3. counts lists every category, zeroed, on clean text'
  );
  assertJson(r.findings, [], '3. no findings on clean text');
  assertEqual(r.truncated, false, '3. clean text is not truncated');
}


// 4. BOM carries atStart; other categories do not carry the key.
{
  const r = inspectTextDetailed(ch(0xFEFF) + 'x' + ch(0xFEFF) + ch(0x200B));
  assertEqual(r.findings[0].atStart, true, '4. BOM at offset 0 is atStart: true');
  assertEqual(r.findings[1].atStart, false, '4. BOM mid-text is atStart: false');
  assertEqual('atStart' in r.findings[2], false, '4. non-BOM findings have no atStart key');
  assertEqual(r.counts.bom, 2, '4. both BOMs counted');
}


// 5. Lines end at LF, CR, or CRLF (counted once); columns are 1-based UTF-16 units.
{
  const Z = ch(0x200B);
  const text = Z + LF + 'ab' + Z + CR + LF + Z + CR + '😊' + Z + LF + LF + CR + Z;
  const located = inspectTextDetailed(text).findings.map(f => [f.offset, f.line, f.column]);
  assertJson(
    located,
    [
      [0, 1, 1],   // start of text
      [4, 2, 3],   // after LF, behind "ab"
      [7, 3, 1],   // after CRLF (one line, not two)
      [11, 4, 3],  // after lone CR; the emoji is two UTF-16 units
      [15, 7, 1],  // after LF, LF, CR
    ],
    '5. offset/line/column across LF, CRLF, CR and a surrogate pair'
  );
}


// 6. maxFindings caps the list, never the counts.
{
  const text = ch(0x200B).repeat(150) + ch(0x202E);

  const def = inspectTextDetailed(text);
  assertEqual(def.findings.length, 100, '6. default cap lists 100 findings');
  assertEqual(def.total, 151, '6. total counts every occurrence');
  assertEqual(def.counts.zero_width, 150, '6. counts are not capped');
  assertEqual(def.counts.bidi_control, 1, '6. a finding past the cap is still counted');
  assertEqual(def.truncated, true, '6. truncated when total exceeds the list');

  const two = inspectTextDetailed(text, { maxFindings: 2 });
  assertJson(two.findings.map(f => f.offset), [0, 1], '6. maxFindings: 2 lists the first two in offset order');

  const none = inspectTextDetailed(text, { maxFindings: 0 });
  assertEqual(none.findings.length, 0, '6. maxFindings: 0 lists nothing');
  assertEqual(none.total, 151, '6. maxFindings: 0 still counts');

  const all = inspectTextDetailed(text, { maxFindings: Infinity });
  assertEqual(all.findings.length, 151, '6. maxFindings: Infinity lists everything');
  assertEqual(all.truncated, false, '6. Infinity is not truncated');

  const exact = inspectTextDetailed(text, { maxFindings: 151 });
  assertEqual(exact.truncated, false, '6. a cap equal to total is not truncated');

  for (const bad of [-1, 1.5, NaN, '5', null]) {
    assertEqual(
      inspectTextDetailed(text, { maxFindings: bad }).findings.length,
      100,
      `6. invalid maxFindings (${String(bad)}) falls back to the default`
    );
  }
}


// 7. Input validation.
{
  let threw = null;
  try {
    inspectTextDetailed(42);
  } catch (e) {
    threw = e;
  }
  assertEqual(threw instanceof TypeError, true, '7. non-string input throws TypeError');
  assertEqual(inspectTextDetailed('').total, 0, '7. empty string has no findings');
  assertEqual(inspectTextDetailed('x', null).total, 0, '7. null options is accepted');
}


// 8. inspectText's output shape is unchanged.
{
  const r = inspectText('A' + ch(0x2066) + 'B' + CR + LF);
  assertJson(
    Object.keys(r),
    ['hasControlChars', 'hasInvisibleChars', 'hasMixedNewlines', 'newlineStyle', 'hasEmojis', 'hasNonKeyboardChars', 'summary'],
    '8. inspectText keys unchanged'
  );
  assertEqual(r.newlineStyle, 'CRLF', '8. inspectText newline style still reported');
}


// 9. getNewlineStats matches the regex implementation it replaced.
{
  function regexNewlineStats(text) {
    const crlfRe = new RegExp(CR + LF, 'g');
    const crlf = (text.match(crlfRe) || []).length;
    const rest = text.replace(crlfRe, '');
    const cr = (rest.match(new RegExp(CR, 'g')) || []).length;
    const lf = (rest.match(new RegExp(LF, 'g')) || []).length;
    const types = [];
    if (crlf > 0) types.push('CRLF');
    if (cr > 0) types.push('CR');
    if (lf > 0) types.push('LF');
    return { crlf, cr, lf, types, mixed: types.length > 1 };
  }

  const cases = [
    '', 'abc', LF, CR, CR + LF, LF + CR, CR + CR + LF + LF, CR + LF + CR + LF,
    'a' + CR, CR + 'a', 'a' + CR + LF + 'b' + LF + 'c' + CR + 'd',
  ];
  // Deterministic fuzz over the alphabet {CR, LF, 'x'}
  let seed = 12345;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
  const alphabet = [CR, LF, 'x'];
  for (let k = 0; k < 2000; k++) {
    let s = '';
    const len = next() % 12;
    for (let j = 0; j < len; j++) s += alphabet[next() % 3];
    cases.push(s);
  }

  const diverging = cases.filter(s => JSON.stringify(getNewlineStats(s)) !== JSON.stringify(regexNewlineStats(s)));
  assertEqual(diverging.length, 0, `9. getNewlineStats equals the regex version on ${cases.length} inputs`);
}


console.log('All inspectTextDetailed tests finished.');
