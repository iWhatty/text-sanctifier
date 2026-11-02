// ./tests/context.test.js
//
// text-sanctifier/context: inspectTextInContext marks findings that belong to
// legitimate sequences as benign and counts them exactly. Also findHiddenRuns
// code-point totals. `npm test` runs this with --expose-gc for the heap checks.

import { inspectTextInContext } from '../src/context.js';
import { inspectTextDetailed } from '../src/index.js';
import { findHiddenRuns } from '../src/hiddenText.js';


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


console.log('All context tests finished.');
