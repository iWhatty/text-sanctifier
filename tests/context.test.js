// ./tests/context.test.js
//
// text-sanctifier/context: inspectTextInContext marks findings that belong to
// legitimate sequences as benign and counts them exactly. Also findHiddenRuns
// code-point totals, and purgeInvisibleInContext, which removes all but the benign ones. `npm test` runs this with --expose-gc for the heap checks.

import { inspectTextInContext, purgeInvisibleInContext } from '../src/context.js';
import { inspectTextDetailed, summonSanctifier } from '../src/index.js';
import { SPACE_LOOKALIKES_REGEX } from '../src/sanctifyText.js';
import { findHiddenRuns, removeHiddenRuns } from '../src/hiddenText.js';


function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ ${message}\n  Expected: "${expected}"\n  Received: "${actual}"`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

const cp = (n) => String.fromCodePoint(n);
const ZWJ = cp(0x200D);
const ZWSP = cp(0x200B);
const VS15 = cp(0xFE0E);
const VS16 = cp(0xFE0F);
const KEYCAP = cp(0x20E3);
const tags = (s) => [...s].map((c) => cp(0xE0000 + c.charCodeAt(0))).join('');
const CANCEL = cp(0xE007F);
const BLACK_FLAG = cp(0x1F3F4);

// The benign flag of each finding, in order, as a string of 1s and 0s
const flags = (text) => inspectTextInContext(text, { maxFindings: Infinity }).findings.map((f) => (f.benign ? '1' : '0')).join('');

function heapGrowthMb(fn) {
  if (globalThis.gc) globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  const result = fn();
  const grew = (process.memoryUsage().heapUsed - before) / (1024 * 1024);
  return { result, grew };
}


// 1. Emoji ZWJ sequences
{
  const MAN = cp(0x1F468), WOMAN = cp(0x1F469), GIRL = cp(0x1F467);
  assertEqual(flags(MAN + ZWJ + WOMAN + ZWJ + GIRL), '11', '1. family emoji: both joiners benign');
  assertEqual(flags(WOMAN + cp(0x1F3FD) + ZWJ + cp(0x1F4BB)), '1', '1. joiner after a skin-tone modifier is benign');
  assertEqual(flags(cp(0x2764) + VS16 + ZWJ + cp(0x1F525)), '11', '1. VS16 then joiner (heart on fire): both benign');
  assertEqual(flags(cp(0x1F3F3) + VS16 + ZWJ + cp(0x1F308)), '11', '1. rainbow flag: selector and joiner benign');
  assertEqual(flags(MAN + ZWJ + cp(0x1F9B0)), '1', '1. joiner before a hair component is benign');
  assertEqual(flags('a' + ZWJ + 'b'), '0', '1. joiner between letters is not benign');
  assertEqual(flags(ZWJ + MAN), '0', '1. joiner at the start is not benign');
  assertEqual(flags(MAN + ZWJ), '0', '1. joiner at the end is not benign');
  assertEqual(flags(MAN + ZWJ + 'x'), '0', '1. joiner before a letter is not benign');
  assertEqual(flags(MAN + ZWJ + ZWJ + WOMAN), '00', '1. two joiners in a row are not benign');
  assertEqual(flags(MAN + ZWSP + WOMAN), '0', '1. a zero width space between emoji is never benign');
  assertEqual(flags(MAN + cp(0x2060) + WOMAN), '0', '1. a word joiner between emoji is never benign');
}


// 2. Presentation selectors
{
  assertEqual(flags(cp(0x270C) + VS16), '1', '2. VS16 after an emoji is benign');
  assertEqual(flags(cp(0x2764) + VS15), '1', '2. VS15 after an emoji is benign');
  assertEqual(flags('1' + VS16 + KEYCAP), '1', '2. keycap: VS16 between a digit and U+20E3 is benign');
  assertEqual(flags('#' + VS16 + KEYCAP) + flags('*' + VS16 + KEYCAP), '11', '2. keycap # and * are benign');
  assertEqual(flags('1' + VS16), '0', '2. VS16 after a digit without U+20E3 is not benign');
  assertEqual(flags('a' + VS16), '0', '2. VS16 after a letter is not benign');
  assertEqual(flags(VS16), '0', '2. VS16 at the start is not benign');
  assertEqual(flags(cp(0x270C) + VS16 + VS16), '10', '2. a second VS16 is not benign');
  assertEqual(flags(cp(0x270C) + cp(0xFE00)), '0', '2. VS1 after an emoji is not benign');
}


// 3. Ideographic variation sequences
{
  const KUZU = cp(0x845B);
  assertEqual(flags(KUZU + cp(0xE0100)), '1', '3. VS17 after an ideograph is benign');
  assertEqual(flags(KUZU + cp(0xE01EF)), '1', '3. VS256 after an ideograph is benign');
  assertEqual(flags(cp(0x20000) + cp(0xE0101)), '1', '3. after a supplementary-plane ideograph is benign');
  assertEqual(flags('a' + cp(0xE0100)), '0', '3. after a letter is not benign');
  assertEqual(flags(KUZU + cp(0xE0100) + cp(0xE0101)), '10', '3. only the first selector after an ideograph is benign');
  assertEqual(flags(cp(0xE0100)), '0', '3. at the start is not benign');
}


// 4. Mongolian free variation selectors
{
  assertEqual(flags(cp(0x1820) + cp(0x180B)) + flags(cp(0x1873) + cp(0x180F)), '11', '4. FVS after a Mongolian letter is benign');
  assertEqual(flags('a' + cp(0x180B)), '0', '4. FVS after a Latin letter is not benign');
  assertEqual(flags(cp(0x1820) + cp(0x180B) + cp(0x180C)), '10', '4. a second FVS is not benign');
}


// 5. Subdivision flags
{
  assertEqual(flags(BLACK_FLAG + tags('gbeng') + CANCEL), '111111', '5. England flag: all six tags benign');
  assertEqual(flags(BLACK_FLAG + tags('gbsct') + CANCEL) + flags(BLACK_FLAG + tags('gbwls') + CANCEL), '111111111111', '5. Scotland and Wales');
  assertEqual(flags(tags('gbeng') + CANCEL), '000000', '5. flag tags without U+1F3F4 are not benign');
  assertEqual(flags(BLACK_FLAG + tags('gbengx') + CANCEL), '0000000', '5. a flag carrying an extra tag is not benign');
  assertEqual(flags(BLACK_FLAG + tags('usca') + CANCEL), '00000', '5. a subdivision outside the RGI set is not benign');
  assertEqual(flags(BLACK_FLAG + tags('gbeng')), '00000', '5. no CANCEL TAG: not benign');
  assertEqual(flags(BLACK_FLAG + tags('gbeng') + CANCEL + tags('hi')), '00000000', '5. a flag followed by more tags is not benign, as in findHiddenRuns');
  assertEqual(flags(BLACK_FLAG + tags('gbeng') + CANCEL + cp(0xE0100)), '1111110', '5. a flag followed by a selector is still a flag');
}


// 6. Never benign
{
  const MAN = cp(0x1F468);
  assertEqual(flags(MAN + cp(0x202E) + MAN), '0', '6. bidi control between emoji');
  assertEqual(flags(cp(0xFEFF) + 'x'), '0', '6. a BOM, even at offset 0');
  assertEqual(flags(cp(0x00A0)), '0', '6. a non-breaking space');
  assertEqual(flags(cp(0x2061)), '0', '6. an invisible operator');
}


// 7. Same report as inspectTextDetailed, plus benign data; counts exact under a cap
{
  const MAN = cp(0x1F468), WOMAN = cp(0x1F469);
  const text = `a${ZWSP}b\n${MAN}${ZWJ}${WOMAN} ${cp(0x270C)}${VS16}\r\n${cp(0x845B)}${cp(0xE0100)} x${ZWJ}y ${BLACK_FLAG}${tags('gbwls')}${CANCEL}${cp(0x202E)}`;
  const base = inspectTextDetailed(text, { maxFindings: Infinity });
  const ctx = inspectTextInContext(text, { maxFindings: Infinity });
  assertEqual(JSON.stringify(ctx.counts), JSON.stringify(base.counts), '7. counts equal inspectTextDetailed');
  assertEqual(ctx.total + ':' + ctx.truncated, base.total + ':' + base.truncated, '7. total and truncated equal inspectTextDetailed');
  assertEqual(
    JSON.stringify(ctx.findings.map(({ benign, ...rest }) => rest)),
    JSON.stringify(base.findings),
    '7. findings equal inspectTextDetailed apart from benign'
  );
  assertEqual(ctx.findings.every((f) => typeof f.benign === 'boolean'), true, '7. every listed finding has a boolean benign');

  const listed = {};
  for (const f of ctx.findings) if (f.benign) listed[f.category] = (listed[f.category] || 0) + 1;
  const nonzero = Object.fromEntries(Object.entries(ctx.benignCounts).filter(([, n]) => n > 0));
  assertEqual(JSON.stringify(nonzero), JSON.stringify({ zero_width: 1, variation_selector: 2, tag: 6 }), '7. benignCounts by category');
  assertEqual(JSON.stringify(Object.keys(ctx.benignCounts)), JSON.stringify(Object.keys(ctx.counts)), '7. benignCounts has the same keys as counts');
  assertEqual(JSON.stringify(Object.fromEntries(Object.entries(listed).sort())), JSON.stringify(Object.fromEntries(Object.entries(nonzero).sort())), '7. benignCounts equals the benign listed findings when nothing is cut');
  assertEqual(ctx.benignTotal, 9, '7. benignTotal is the sum of benignCounts');
  assertEqual(Object.keys(ctx.counts).every((c) => ctx.benignCounts[c] <= ctx.counts[c]), true, '7. benignCounts never exceeds counts');

  const capped = inspectTextInContext(text, { maxFindings: 1 });
  assertEqual(capped.findings.length + ':' + capped.truncated, '1:true', '7. maxFindings caps the list');
  assertEqual(JSON.stringify(capped.benignCounts), JSON.stringify(ctx.benignCounts), '7. benignCounts stay exact under maxFindings');
  assertEqual(inspectTextInContext(text).findings.length, base.findings.length, '7. default maxFindings as in inspectTextDetailed');
  assertEqual(inspectTextInContext('plain').benignTotal, 0, '7. clean text');

  let threw = false;
  try { inspectTextInContext(42); } catch (e) { threw = e instanceof TypeError; }
  assertEqual(threw, true, '7. non-string throws TypeError');

  const entry = await import('text-sanctifier/context');
  assertEqual(entry.inspectTextInContext === inspectTextInContext, true, '7. text-sanctifier/context through the package exports map');
  assertEqual(entry.purgeInvisibleInContext === purgeInvisibleInContext, true, '7. purgeInvisibleInContext through the package exports map');
  assertEqual((await import('text-sanctifier/hidden')).removeHiddenRuns === removeHiddenRuns, true, '7. removeHiddenRuns through the package exports map');
}


// 8. findHiddenRuns code-point totals
{
  const text = `a${cp(0x2061)}${cp(0x2062)}b${tags('xyz')}c${cp(0xFE00)}${cp(0xE0100)}${cp(0xE0101)}d${cp(0xE0080)}e${cp(0x270C)}${VS16}${BLACK_FLAG}${tags('gbwls')}${CANCEL}`;
  const scan = findHiddenRuns(text, { maxRuns: 1 });
  assertEqual(JSON.stringify(scan.codePointCounts), '{"tag":3,"variation_selector":3,"invisible_operator":2,"reserved_tag_plane":1}', '8. codePointCounts per kind, benign spans left out, exact under maxRuns');
  assertEqual(scan.supplementarySelectorCount, 2, '8. supplementarySelectorCount counts U+E0100-U+E01EF only');
  const none = findHiddenRuns('plain');
  assertEqual(JSON.stringify(none.codePointCounts) + none.supplementarySelectorCount, '{"tag":0,"variation_selector":0,"invisible_operator":0,"reserved_tag_plane":0}0', '8. zeros on clean text');
}


// 9. Heap stays flat on 16 M-unit (32 MB) inputs with maxFindings set
{
  const M = 8 * 1024 * 1024;
  const joiners = (cp(0x1F468) + ZWJ).repeat(M / 2) + cp(0x1F468); // 16 M units, 4 M benign joiners
  joiners.charCodeAt(0);
  const a = heapGrowthMb(() => inspectTextInContext(joiners, { maxFindings: 20 }));
  assertEqual(a.result.benignCounts.zero_width + ':' + a.result.findings.length, `${M / 2}:20`, '9. 4 M benign joiners counted, 20 listed');
  assertEqual(a.grew < 4, true, `9. 16 M units of emoji joiners, maxFindings: 20 (heap grew ${a.grew.toFixed(1)} MB, limit 4)`);

  const spaces = ('a' + ZWSP).repeat(M);
  spaces.charCodeAt(0);
  const b = heapGrowthMb(() => inspectTextInContext(spaces, { maxFindings: 20 }));
  assertEqual(b.result.counts.zero_width + ':' + b.result.benignTotal, `${M}:0`, '9. 8 M zero width spaces, none benign');
  assertEqual(b.grew < 4, true, `9. 16 M units of zero width spaces, maxFindings: 20 (heap grew ${b.grew.toFixed(1)} MB, limit 4)`);
}


// 10. Joiners in scripts that need them: IDNA ContextJ (RFC 5892, appendix A.1 and A.2)
{
  const ZWNJ = cp(0x200C);
  const KA = cp(0x0915), SSA = cp(0x0937), VIRAMA = cp(0x094D), NUKTA = cp(0x093C);
  assertEqual(flags(KA + VIRAMA + ZWJ + SSA), '1', '10. Devanagari: ZWJ after a virama is benign');
  assertEqual(flags(KA + VIRAMA + ZWNJ + SSA), '1', '10. Devanagari: ZWNJ after a virama is benign');
  assertEqual(flags(cp(0x0995) + cp(0x09CD) + ZWJ) + flags(cp(0x0D15) + cp(0x0D4D) + ZWJ), '11', '10. Bengali and Malayalam viramas');
  assertEqual(flags(cp(0x0DA4) + cp(0x0DCA) + ZWJ) + flags(cp(0x1000) + cp(0x103A) + ZWNJ), '11', '10. Sinhala al-lakuna and Myanmar asat');
  assertEqual(flags(cp(0x11013) + cp(0x11046) + ZWJ), '1', '10. Brahmi: a supplementary-plane virama');
  assertEqual(flags(KA + ZWJ + SSA) + flags(KA + ZWNJ + SSA), '00', '10. joiners after a consonant without a virama are not benign');
  assertEqual(flags(KA + NUKTA + ZWJ), '0', '10. a nukta is not a virama');
  assertEqual(flags(KA + VIRAMA + ZWJ + ZWJ), '10', '10. only the joiner right after the virama is benign');
  assertEqual(flags(KA + VIRAMA + ZWSP), '0', '10. a zero width space after a virama is not benign');

  // Persian: U+200C between two Arabic-script letters, skipping marks
  const MEEM = cp(0x0645), YEH = cp(0x06CC), KHAH = cp(0x062E), BEH = cp(0x0628), HEH = cp(0x0647);
  assertEqual(flags(MEEM + YEH + ZWNJ + KHAH), '1', '10. Persian: ZWNJ between Arabic letters is benign');
  assertEqual(flags(BEH + cp(0x064E) + ZWNJ + cp(0x0651) + HEH), '1', '10. Persian: marks on either side are skipped');
  assertEqual(flags(cp(0x05D0) + ZWNJ + BEH), '0', '10. a Hebrew letter before is not benign');
  assertEqual(flags(BEH + ZWNJ + 'a') + flags('a' + ZWNJ + BEH), '00', '10. a Latin letter on one side is not benign');
  assertEqual(flags('a' + ZWNJ + 'b'), '0', '10. ZWNJ between Latin letters is not benign');
  assertEqual(flags(ZWNJ + BEH) + flags(BEH + ZWNJ), '00', '10. ZWNJ at the start or the end is not benign');
  assertEqual(flags(BEH + ZWNJ + ZWNJ + HEH), '00', '10. two ZWNJ in a row are not benign');
  assertEqual(flags(BEH + cp(0x064E) + cp(0x064E)), '', '10. marks alone are not findings');
  assertEqual(flags(BEH + ZWJ + HEH), '0', '10. ZWJ between Arabic letters is not benign (only after a virama)');
  assertEqual(flags(BEH + ZWSP + HEH), '0', '10. a zero width space between Arabic letters is not benign');

  const report = inspectTextInContext(`${MEEM}${YEH}${ZWNJ}${KHAH} ${KA}${VIRAMA}${ZWJ}${SSA} a${ZWNJ}b`, { maxFindings: 0 });
  assertEqual(report.counts.zero_width + ':' + report.benignCounts.zero_width, '3:2', '10. benignCounts.zero_width counts the script joiners');
}


// 11. benignSupplementarySelectorCount: suspicious U+E0100-U+E01EF are counted exactly
{
  const text = `${cp(0x845B)}${cp(0xE0100)} a${cp(0xE0101)} ${cp(0xFE00)} ${cp(0x270C)}${VS16} ${cp(0x20000)}${cp(0xE01EF)}${cp(0xE0102)}`;
  const ctx = inspectTextInContext(text, { maxFindings: 1 });
  assertEqual(ctx.benignSupplementarySelectorCount, 2, '11. two benign ideographic variation selectors');
  assertEqual(ctx.benignCounts.variation_selector, 3, '11. benignCounts.variation_selector also counts VS16');
  const scan = findHiddenRuns(text);
  assertEqual(scan.supplementarySelectorCount - ctx.benignSupplementarySelectorCount, 2, '11. findHiddenRuns supplementarySelectorCount minus it is the suspicious count');
  assertEqual(inspectTextInContext('plain').benignSupplementarySelectorCount, 0, '11. zero on clean text');

  // A run's `sequence` agrees with the benign mark on the same selector
  const bases = ['', 'a', ' ', cp(0x845B), cp(0x20000), cp(0x1820), cp(0x18AA), cp(0x18A9), cp(0x270C)];
  const selectors = [0xFE00, 0xE0100, 0xE01EF, 0x180B, 0x180D, 0x180F];
  let disagreements = 0;
  for (const base of bases) {
    for (const selector of selectors) {
      const sample = base + cp(selector);
      const finding = inspectTextInContext(sample).findings[0];
      if (findHiddenRuns(sample).runs[0].sequence !== undefined !== finding.benign) disagreements++;
    }
  }
  assertEqual(disagreements, 0, '11. sequence matches context on lone selectors');
}


// 12. Heap stays flat with many script joiners
{
  const M = 8 * 1024 * 1024;
  const persian = (cp(0x0628) + cp(0x200C)).repeat(M); // 16 M units
  persian.charCodeAt(0);
  const a = heapGrowthMb(() => inspectTextInContext(persian, { maxFindings: 20 }));
  assertEqual(a.result.benignCounts.zero_width + ':' + a.result.counts.zero_width, `${M - 1}:${M}`, '12. 8 M ZWNJ between Arabic letters: all benign but the last');
  assertEqual(a.grew < 4, true, `12. 16 M units of Persian joiners, maxFindings: 20 (heap grew ${a.grew.toFixed(1)} MB, limit 4)`);
}


// purgeInvisibleInContext: removes what purgeInvisibleChars removes, except benign sequences.
{
  const c = (...n) => String.fromCodePoint(...n);
  const tags = (ascii) => [...ascii].map((ch) => c(0xE0000 + ch.charCodeAt(0))).join('');
  const show = (s) => [...s].map((ch) => (ch >= ' ' && ch <= '~' ? ch : '<' + ch.codePointAt(0).toString(16) + '>')).join('');
  const BLACK_FLAG = c(0x1F3F4);
  const CANCEL = c(0xE007F);
  const FAMILY = c(0x1F468, 0x200D, 0x1F469, 0x200D, 0x1F467);
  const NBSP = c(0xA0);
  const ZW = c(0x200B);

  const legitimate = {
    'family emoji': FAMILY,
    'flag of England': BLACK_FLAG + tags('gbeng') + CANCEL,
    'red heart': c(0x2764, 0xFE0F),
    'Persian word with a joiner': c(0x645, 0x6CC, 0x200C, 0x62E, 0x648, 0x627, 0x647, 0x645),
    'Hindi joiner after a virama': c(0x915, 0x94D, 0x200D, 0x937),
    'no-break space from a rich editor': 'two' + NBSP + 'words',
    'thin spaces in French': 'dit' + c(0x202F) + ': oui' + c(0x2009) + '!',
    'ideographic space': 'a' + c(0x3000) + 'b',
  };
  for (const [name, text] of Object.entries(legitimate)) {
    const result = purgeInvisibleInContext(text);
    assertEqual(show(result.text) + ' / ' + result.removed, show(text) + ' / 0', 'purge keeps: ' + name);
  }

  const hidden = {
    'zero-width space': ['a' + ZW + 'b', 'ab', 1],
    'joiner in a Latin word': ['pay' + c(0x200D) + 'pal', 'paypal', 1],
    'bidi control': ['a' + c(0x202E) + 'b', 'ab', 1],
    'soft hyphen': ['co' + c(0xAD) + 'op', 'coop', 1],
    'tag text': ['hi' + tags('secret'), 'hi', 6],
    'tag text after a black flag': [BLACK_FLAG + tags('hello') + CANCEL, BLACK_FLAG, 6],
    'hidden character next to a kept space': ['two' + ZW + NBSP + 'words', 'two' + NBSP + 'words', 1],
    'hidden characters around a family': ['a' + ZW + FAMILY + ZW + 'b', 'a' + FAMILY + 'b', 2],
  };
  for (const [name, [text, clean, removed]] of Object.entries(hidden)) {
    const result = purgeInvisibleInContext(text);
    assertEqual(show(result.text) + ' / ' + result.removed, show(clean) + ' / ' + removed, 'purge removes: ' + name);
  }

  const spaced = 'two' + NBSP + 'words' + c(0x3000) + 'x';
  assertEqual(show(purgeInvisibleInContext(spaced, { spaces: 'keep' }).text), show(spaced), 'purge spaces keep: look-alike spaces stay');
  assertEqual(show(purgeInvisibleInContext(spaced, { spaces: 'normalize' }).text), show('two words' + c(0x3000) + 'x'), 'purge spaces normalize: becomes a space, U+3000 stays');
  assertEqual(purgeInvisibleInContext(spaced, { spaces: 'normalize' }).removed, 0, 'purge spaces normalize: a replaced space is not counted as removed');
  const removedSpaces = purgeInvisibleInContext(spaced, { spaces: 'remove' });
  assertEqual(show(removedSpaces.text) + ' / ' + removedSpaces.removed, show('twowords' + c(0x3000) + 'x') + ' / 1', 'purge spaces remove: deleted and counted, U+3000 stays');

  // The space set is the sanitizer's SPACE_LOOKALIKES_REGEX, over every BMP code unit.
  let spaceMismatch = '';
  for (let unit = 0; unit < 0x10000 && !spaceMismatch; unit++) {
    if (unit >= 0xD800 && unit <= 0xDFFF) continue;
    const ch = String.fromCharCode(unit);
    SPACE_LOOKALIKES_REGEX.lastIndex = 0;
    const isSpace = SPACE_LOOKALIKES_REGEX.test(ch);
    const kept = purgeInvisibleInContext('a' + ch + 'b', { spaces: 'normalize' }).text === 'a b';
    if (isSpace !== (kept && ch !== ' ')) spaceMismatch = 'U+' + unit.toString(16);
  }
  assertEqual(spaceMismatch, '', 'purge: look-alike spaces are exactly SPACE_LOOKALIKES_REGEX');

  for (const bad of ['delete', '', null, 1, true]) {
    let error;
    try { purgeInvisibleInContext('a', { spaces: bad }); } catch (e) { error = e; }
    assertEqual(error instanceof RangeError, true, 'purge rejects invalid spaces (' + String(bad) + ')');
  }
  let typeError;
  try { purgeInvisibleInContext(42); } catch (e) { typeError = e; }
  assertEqual(typeError instanceof TypeError, true, 'purge: non-string throws TypeError');
  assertEqual(purgeInvisibleInContext('', undefined).text, '', 'purge: empty text, no options');

  // After the other cleaning options, as an editor's "fix all" would run it.
  const others = summonSanctifier({ nukeControls: true, normalizeNewlines: true });
  const mixed = FAMILY + ZW + c(0x07) + '\r\nnext\nline';
  assertEqual(show(purgeInvisibleInContext(others(mixed)).text), show(FAMILY + '\nnext\nline'), 'purge after controls and newlines: legitimate text survives all three');

  // Unpaired halves around a removed character must not join into a tag character.
  const halves = String.fromCharCode(0xDB40) + ZW + String.fromCharCode(0xDC41);
  assertEqual(show(purgeInvisibleInContext(halves).text), show(c(0xFFFD, 0xFFFD)), 'purge: split surrogate halves stay apart');

  // Context is read from the whole text, across the internal chunk boundary.
  for (const pad of [65533, 65534, 65535, 65536, 65537]) {
    const text = 'x'.repeat(pad) + FAMILY + ZW + BLACK_FLAG + tags('gbsct') + CANCEL + ZW;
    const result = purgeInvisibleInContext(text);
    assertEqual(result.text === 'x'.repeat(pad) + FAMILY + BLACK_FLAG + tags('gbsct') + CANCEL && result.removed === 2, true, 'purge: sequences survive a chunk boundary at ' + pad);
  }

  // Fixed-seed invariants.
  const alphabet = ['a', 'b', ' ', '\n', '#', '1', NBSP, ZW, c(0x200C), c(0x200D), c(0x2060), c(0xFEFF), c(0xFE0F), c(0xFE0E), c(0x20E3),
    c(0x3000), c(0x202E), c(0x2003), c(0xAD), c(0x1F600), c(0x1F469), c(0x1F3FD), c(0x2764), BLACK_FLAG, c(0xE0067), c(0xE0062), c(0xE0065), c(0xE006E),
    CANCEL, c(0xE0100), c(0x4E00), c(0x94D), c(0x915), c(0x644), c(0x64E), c(0x1820), c(0x180B), String.fromCharCode(0xD83D), String.fromCharCode(0xDB40), String.fromCharCode(0xDC67)];
  const purgeAll = summonSanctifier({ purgeInvisibleChars: true });
  let seed = 0x2545F491;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  let failure = '';
  for (let k = 0; k < 20000 && !failure; k++) {
    let s = '';
    for (let j = (next() >>> 16) % 12; j >= 0; j--) s += alphabet[(next() >>> 16) % alphabet.length];
    for (const spaces of ['keep', 'normalize', 'remove']) {
      const once = purgeInvisibleInContext(s, { spaces });
      const twice = purgeInvisibleInContext(once.text, { spaces });
      const report = inspectTextInContext(once.text, { maxFindings: 0 });
      const suspicious = Object.keys(report.counts).filter((key) => key !== 'nonbreaking_space' && report.counts[key] - report.benignCounts[key] > 0 && !['nul', 'c0_control', 'c1_control'].includes(key));
      if (twice.text !== once.text || twice.removed !== 0) failure = 'not stable (' + spaces + '): ' + show(s);
      else if (suspicious.length) failure = 'suspicious ' + suspicious.join(',') + ' left (' + spaces + '): ' + show(s);
      else if (spaces !== 'normalize' && [...s].length - [...once.text].length !== once.removed) failure = 'removed count wrong (' + spaces + '): ' + show(s);
      else if (spaces === 'remove' && report.benignTotal === 0 && inspectTextInContext(s, { maxFindings: 0 }).benignTotal === 0 && once.text !== purgeAll(s)) failure = 'differs from purgeInvisibleChars without benign text: ' + show(s);
    }
  }
  assertEqual(failure, '', 'purge: stable, nothing suspicious left, exact removed count, same as purgeInvisibleChars when nothing is benign');
}

console.log('All context tests finished.');

for (const bad of ['1', -1, null, 1.5, NaN, -Infinity, {}, true]) {
  let error;
  try { inspectTextInContext(ZWSP, { maxFindings: bad }); } catch (e) { error = e; }
  assertEqual(error instanceof RangeError, true, `context rejects invalid cap (${String(bad)})`);
}
