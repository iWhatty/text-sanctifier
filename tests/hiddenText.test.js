// ./tests/hiddenText.test.js
//
// text-sanctifier/hidden: run caps and exact counts, positions, the decoded-text cap,
// and the VERSION export. `npm test` runs it with --expose-gc, so the heap checks also
// catch large temporary allocations, not only what the result keeps.

import { readFileSync } from 'node:fs';
import { findHiddenRuns, removeHiddenRuns, decodeTagText, VERSION as HIDDEN_VERSION } from '../src/hiddenText.js';
import { inspectTextDetailed, VERSION } from '../src/index.js';


function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ ${message}\n  Expected: "${expected}"\n  Received: "${actual}"`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

const cp = (n) => String.fromCodePoint(n);
const tags = (s) => [...s].map((c) => cp(0xE0000 + c.charCodeAt(0))).join('');
const CANCEL = cp(0xE007F);
const WALES = cp(0x1F3F4) + tags('gbwls') + CANCEL;
const VS16 = cp(0xFE0F);
const OP = cp(0x2061);
const HEART = cp(0x2764); // HEAVY BLACK HEART, Extended_Pictographic

for (const fn of [findHiddenRuns, decodeTagText]) {
  for (const value of [42, null, undefined, {}, []]) {
    let error;
    try { fn(value); } catch (e) { error = e; }
    assertEqual(error instanceof TypeError && error.message === `${fn.name} expects a string input.`, true, `${fn.name} rejects non-string input`);
  }
}

function heapGrowthMb(fn) {
  if (globalThis.gc) globalThis.gc();
  const before = process.memoryUsage().heapUsed;
  const result = fn();
  const grew = (process.memoryUsage().heapUsed - before) / (1024 * 1024);
  return { result, grew };
}


// 1. VERSION is generated from package.json
{
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assertEqual(VERSION, pkg.version, '1. VERSION from the package root equals package.json');
  assertEqual(HIDDEN_VERSION, pkg.version, '1. VERSION from text-sanctifier/hidden equals package.json');
}


// 2. maxRuns caps the list; counts, total and truncated stay exact
{
  const text = `a${OP}b${OP}${OP}c${tags('x')}d${OP}e${OP}f`;
  const all = findHiddenRuns(text);
  assertEqual(all.runs.length, 5, '2. no options: every run is listed');
  assertEqual(JSON.stringify(all.counts), '{"tag":1,"variation_selector":0,"invisible_operator":4,"reserved_tag_plane":0}', '2. counts per run kind');
  assertEqual(all.total, 5, '2. total is the sum of counts');
  assertEqual(all.truncated, false, '2. not truncated when everything is listed');

  const capped = findHiddenRuns(text, { maxRuns: 2 });
  assertEqual(capped.runs.length, 2, '2. maxRuns: 2 lists two runs');
  assertEqual(capped.runs.map((r) => r.offset).join(','), all.runs.slice(0, 2).map((r) => r.offset).join(','), '2. maxRuns keeps the first runs in order');
  assertEqual(JSON.stringify(capped.counts), JSON.stringify(all.counts), '2. maxRuns: counts unchanged');
  assertEqual(capped.total, 5, '2. maxRuns: total unchanged');
  assertEqual(capped.truncated, true, '2. maxRuns: truncated');

  const none = findHiddenRuns(text, { maxRuns: 0 });
  assertEqual(none.runs.length + ':' + none.total + ':' + none.truncated, '0:5:true', '2. maxRuns: 0 is counts only');
  assertEqual(findHiddenRuns('plain').truncated, false, '2. clean text is not truncated');

  for (const key of ['maxRuns', 'maxDecodedLength']) {
    for (const bad of [-1, 1.5, NaN, '3', null, -Infinity, {}, true]) {
      let error;
      try { findHiddenRuns(text, { [key]: bad }); } catch (e) { error = e; }
      assertEqual(error instanceof RangeError, true, `invalid ${key} (${String(bad)}) throws`);
    }
    assertEqual(findHiddenRuns(text, { [key]: undefined }).total, 5, `undefined ${key} uses default`);
  }

  const benignText = `${HEART}${VS16}b${HEART}${VS16}c${HEART}${VS16}${WALES}`;
  const b = findHiddenRuns(benignText, { maxRuns: 1 });
  assertEqual(b.benign.length, 1, '2. maxRuns also caps benign spans');
  assertEqual(b.benignTotal, 4, '2. benignTotal counts every benign span');
  assertEqual(b.truncated, true, '2. truncated when benign spans were dropped');
  assertEqual(findHiddenRuns(benignText).benignTotal, 4, '2. benignTotal with no cap');
}


// 3. line and column match inspectTextDetailed exactly
{
  const pieces = ['x', '\n', '\r\n', '\r', '\r\r\n', cp(0x1F600), cp(0xA0), 'ab', '\n\n', '\t'];
  const hidden = [OP, VS16, tags('hi'), cp(0xE0100)];
  let mismatches = 0;
  let checked = 0;
  for (let seed = 0; seed < 400; seed++) {
    let s = '';
    let r = seed * 2654435761 >>> 0;
    for (let k = 0; k < 12; k++) {
      r = (r * 1103515245 + 12345) >>> 0;
      s += (r & 3) === 0 ? hidden[(r >>> 4) % hidden.length] : pieces[(r >>> 4) % pieces.length];
    }
    const findings = new Map(inspectTextDetailed(s, { maxFindings: Infinity }).findings.map((f) => [f.offset, f]));
    for (const run of findHiddenRuns(s).runs) {
      const f = findings.get(run.offset);
      checked++;
      if (!f || f.line !== run.line || f.column !== run.column) mismatches++;
    }
  }
  assertEqual(checked > 200, true, `3. checked ${checked} runs against inspectTextDetailed`);
  assertEqual(mismatches, 0, '3. run line/column equal the finding at the same offset');

  const [run] = findHiddenRuns(`ab\r\ncd${cp(0x1F600)}${OP}`).runs;
  assertEqual(`${run.line}:${run.column}`, '2:5', '3. column counts UTF-16 units, CRLF is one line break');
}


// 4. maxDecodedLength caps decoded tag text without cutting a marker
{
  const [full] = findHiddenRuns(tags('Hello world')).runs;
  assertEqual(full.decoded + '|' + full.decodedTruncated, 'Hello world|false', '4. no cap: whole decoded text');

  const [cut] = findHiddenRuns(tags('Hello world'), { maxDecodedLength: 5 }).runs;
  assertEqual(cut.decoded + '|' + cut.decodedTruncated, 'Hello|true', '4. maxDecodedLength: 5');
  assertEqual(cut.count, 11, '4. count is the whole run');

  const [marker] = findHiddenRuns(tags('ab') + CANCEL, { maxDecodedLength: 5 }).runs;
  assertEqual(marker.decoded + '|' + marker.decodedTruncated, 'ab|true', '4. a <U+XXXX> marker is never cut');

  const [zero] = findHiddenRuns(tags('ab'), { maxDecodedLength: 0 }).runs;
  assertEqual(zero.decoded + '|' + zero.decodedTruncated, '|true', '4. maxDecodedLength: 0 decodes nothing');

  assertEqual(findHiddenRuns(WALES, { maxDecodedLength: 1 }).benign.length, 1, '4. subdivision flags stay benign under a small cap');
  const forged = findHiddenRuns(cp(0x1F3F4) + tags('gbwlsx') + CANCEL, { maxDecodedLength: 1 });
  assertEqual(forged.runs.length + ':' + forged.benign.length, '1:0', '4. a flag with extra tags is still a run under a cap');

  const [op] = findHiddenRuns(OP).runs;
  assertEqual('decoded' in op || 'decodedTruncated' in op, false, '4. non-tag runs carry no decoded fields');
}


// 5. Heap stays flat on 16 M-unit (32 MB) inputs when the caps are set
{
  const M = 8 * 1024 * 1024;

  const manyRuns = ('a' + OP).repeat(M); // 16 M UTF-16 units (32 MB), 8 M runs
  manyRuns.charCodeAt(0); // flatten the repeat() rope before measuring
  const a = heapGrowthMb(() => findHiddenRuns(manyRuns, { maxRuns: 100 }));
  assertEqual(a.result.total + ':' + a.result.runs.length, `${M}:100`, '5. 8 M runs counted, 100 listed');
  assertEqual(a.grew < 4, true, `5. 16 M units of short runs, maxRuns: 100 (heap grew ${a.grew.toFixed(1)} MB, limit 4)`);

  const longTag = tags('A').repeat(M); // one tag run of 8 M code points, 16 M units
  longTag.charCodeAt(0);
  const b = heapGrowthMb(() => findHiddenRuns(longTag, { maxDecodedLength: 1000 }));
  assertEqual(b.result.runs[0].count + ':' + b.result.runs[0].decoded.length, `${M}:1000`, '5. one 8 M-tag run, 1000 characters decoded');
  assertEqual(b.grew < 4, true, `5. 16 M-unit tag run, maxDecodedLength: 1000 (heap grew ${b.grew.toFixed(1)} MB, limit 4)`);

  const manyBenign = (HEART + VS16).repeat(M);
  manyBenign.charCodeAt(0);
  const c = heapGrowthMb(() => findHiddenRuns(manyBenign, { maxRuns: 100 }));
  assertEqual(c.result.benignTotal + ':' + c.result.benign.length, `${M}:100`, '5. 8 M benign spans counted, 100 listed');
  assertEqual(c.grew < 4, true, `5. 16 M units of benign spans, maxRuns: 100 (heap grew ${c.grew.toFixed(1)} MB, limit 4)`);
}


// 6. reserved_tag_plane: the unassigned plane-14 code points outside tags and selectors
{
  const kindAt = (n) => { const r = findHiddenRuns('x' + cp(n) + 'x').runs; return r.length === 1 ? r[0].kind : 'none'; };
  assertEqual([0xE0080, 0xE00FF, 0xE01F0, 0xE0FFF].map(kindAt).join(','), 'reserved_tag_plane,reserved_tag_plane,reserved_tag_plane,reserved_tag_plane', '6. U+E0080, U+E00FF, U+E01F0 and U+E0FFF are reserved_tag_plane runs');
  assertEqual([0xE007F, 0xE0100, 0xE01EF, 0xE1000].map(kindAt).join(','), 'tag,variation_selector,variation_selector,none', '6. neighbours keep their kinds; U+E1000 is not a run');

  // Every plane-14 code point up to U+E0FFF is a run, and each kind covers exactly its ranges.
  const wrong = [];
  for (let n = 0xE0000; n <= 0xE0FFF; n++) {
    const expected = n <= 0xE007F ? 'tag' : n >= 0xE0100 && n <= 0xE01EF ? 'variation_selector' : 'reserved_tag_plane';
    if (kindAt(n) !== expected) wrong.push(n.toString(16));
  }
  assertEqual(wrong.join(','), '', '6. U+E0000-U+E0FFF split exactly into tag, variation_selector and reserved_tag_plane');

  const scan = findHiddenRuns(`a${cp(0xE0080)}${cp(0xE0FFF)}b${tags('x')}${cp(0xE00A0)}`);
  assertEqual(scan.runs.map((r) => `${r.kind}:${r.count}`).join(','), 'reserved_tag_plane:2,tag:1,reserved_tag_plane:1', '6. consecutive reserved code points form one run; a kind change starts a new one');
  assertEqual(scan.counts.reserved_tag_plane + ':' + scan.total, '2:3', '6. counts.reserved_tag_plane');
  assertEqual('decoded' in scan.runs[0], false, '6. reserved_tag_plane runs are not decoded');
  assertEqual(findHiddenRuns('plain').counts.reserved_tag_plane, 0, '6. counts has a reserved_tag_plane key');
}


// 7. A lone presentation selector is benign only after an emoji or in a keycap
{
  const VS15 = cp(0xFE0E);
  const KEYCAP = cp(0x20E3);
  assertEqual(findHiddenRuns(HEART + VS16).benignTotal, 1, '7. after an emoji: benign');
  assertEqual(findHiddenRuns(cp(0x1F600) + VS15).benignTotal, 1, '7. after a supplementary emoji: benign');
  assertEqual(findHiddenRuns('1' + VS16 + KEYCAP).benignTotal, 1, '7. keycap: benign');
  assertEqual(findHiddenRuns('1' + VS16).total, 1, '7. after a digit with no keycap: a run');
  assertEqual(findHiddenRuns(VS16 + 'x').total, 1, '7. at the start: a run');
  // One selector per letter carries a bit each, the way data hides in ordinary words
  const smuggled = 'h' + VS15 + 'e' + VS16 + 'l' + VS15 + 'l' + VS16 + 'o' + VS15;
  const scan = findHiddenRuns(smuggled);
  assertEqual(`${scan.total}:${scan.benignTotal}`, '5:0', '7. selectors after letters: every one is a run');
}


// 8. Lone ideographic and Mongolian selectors stay runs, marked with `sequence`
{
  const only = (text) => findHiddenRuns(text).runs.map((run) => run.sequence).join(',');
  const KUZU = cp(0x845B);
  const MONGOLIAN_A = cp(0x1820);
  assertEqual(only(KUZU + cp(0xE0100)), 'ideographic', '8. VS17 after an ideograph');
  assertEqual(only(cp(0x20000) + cp(0xE01EF)), 'ideographic', '8. VS256 after a supplementary-plane ideograph');
  assertEqual(only(MONGOLIAN_A + cp(0x180B)) + only(MONGOLIAN_A + cp(0x180F)), 'mongolianmongolian', '8. FVS after a Mongolian letter');
  assertEqual(only('a' + cp(0xE0100)), '', '8. VS17 after a letter is unmarked');
  assertEqual(only(cp(0xE0100)), '', '8. VS17 at the start is unmarked');
  assertEqual(only('a' + cp(0x180B)), '', '8. FVS after a Latin letter is unmarked');
  assertEqual(only(cp(0x180B)), '', '8. FVS at the start is unmarked');
  assertEqual(only(KUZU + cp(0xE0100) + cp(0xE0101)), '', '8. a stack is unmarked');
  assertEqual(only(KUZU + cp(0xFE00)), '', '8. a low selector after an ideograph is unmarked');
  assertEqual('sequence' in findHiddenRuns(KUZU + cp(0xFE00)).runs[0], false, '8. the key is absent when unmarked');

  // A payload stays visible: one selector per ideograph spells a byte each
  const secret = 'ignore';
  const payload = [...secret].map((ch, i) => cp(0x4E00 + i) + cp(0xE0100 + ch.charCodeAt(0))).join('');
  const scan = findHiddenRuns(payload);
  assertEqual(`${scan.total}:${scan.benignTotal}:${scan.supplementarySelectorCount}`, '6:0:6', '8. every selector of a payload is a counted run');
}

// 9. removeHiddenRuns: every run goes, benign sequences stay, caps limit only the lists.
{
  const c = (...n) => String.fromCodePoint(...n);
  const tags = (ascii) => [...ascii].map((ch) => c(0xE0000 + ch.charCodeAt(0))).join('');
  const show = (s) => [...s].map((ch) => (ch >= ' ' && ch <= '~' ? ch : '<' + ch.codePointAt(0).toString(16) + '>')).join('');
  const BLACK_FLAG = c(0x1F3F4);
  const CANCEL = c(0xE007F);
  const HEART = c(0x2764, 0xFE0F);
  const ENGLAND = BLACK_FLAG + tags('gbeng') + CANCEL;

  const text = 'a' + tags('hi') + 'b' + HEART + c(0x2061) + ENGLAND + 'c' + c(0xFE0F) + BLACK_FLAG + tags('hello') + CANCEL;
  const expected = 'ab' + HEART + ENGLAND + 'c' + BLACK_FLAG;
  const result = removeHiddenRuns(text);
  assertEqual(show(result.text), show(expected), '9. runs removed; heart selector and England flag kept; forged flag stripped');
  const { text: _text, ...scan } = result;
  assertEqual(JSON.stringify(scan), JSON.stringify(findHiddenRuns(text)), '9. the rest of the result is the findHiddenRuns scan of the input');
  assertEqual(result.runs[0].offset, 1, '9. offsets refer to the input');

  const capped = removeHiddenRuns(text, { maxRuns: 0, maxDecodedLength: 0 });
  assertEqual(show(capped.text) + ' / ' + capped.runs.length + ' / ' + capped.total + ' / ' + capped.truncated, show(expected) + ' / 0 / 4 / true', '9. caps limit the lists, never the removal');

  assertEqual(removeHiddenRuns('plain text').text, 'plain text', '9. clean text is returned as it is');
  assertEqual(removeHiddenRuns('').text, '', '9. empty text');
  const ideograph = c(0x4E00, 0xE0100);
  assertEqual(show(removeHiddenRuns(ideograph).text), show(c(0x4E00)), '9. a lone ideographic selector is a run, so it is removed');

  const halves = String.fromCharCode(0xDB40) + tags('x') + String.fromCharCode(0xDC41);
  assertEqual(show(removeHiddenRuns(halves).text), show(c(0xFFFD, 0xFFFD)), '9. halves around a removed run do not join into a tag');

  let typeError;
  try { removeHiddenRuns(42); } catch (e) { typeError = e; }
  assertEqual(typeError instanceof TypeError, true, '9. non-string throws TypeError');
  let rangeError;
  try { removeHiddenRuns('a', { maxRuns: '1' }); } catch (e) { rangeError = e; }
  assertEqual(rangeError instanceof RangeError, true, '9. an invalid cap throws RangeError');

  const alphabet = ['a', ' ', '\n', '#', '1', c(0x200D), c(0xFE0F), c(0xFE0E), c(0x20E3), c(0x2061), c(0x2764), c(0x1F600), BLACK_FLAG,
    c(0xE0067), c(0xE0062), c(0xE0065), c(0xE006E), CANCEL, c(0xE0100), c(0xE0080), c(0x4E00), c(0x1820), c(0x180B),
    String.fromCharCode(0xD83D), String.fromCharCode(0xDB40), String.fromCharCode(0xDC67)];
  let seed = 0x1F123BB5;
  const next = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
  let failure = '';
  for (let k = 0; k < 20000 && !failure; k++) {
    let s = '';
    for (let j = (next() >>> 16) % 12; j >= 0; j--) s += alphabet[(next() >>> 16) % alphabet.length];
    const once = removeHiddenRuns(s, { maxRuns: (next() >>> 16) % 3 });
    const again = findHiddenRuns(once.text);
    if (again.total !== 0) failure = 'runs left: ' + show(s) + ' => ' + show(once.text);
    else if (once.total !== findHiddenRuns(s).total) failure = 'total differs from findHiddenRuns: ' + show(s);
    else if (/[\uD800-\uDFFF]/u.test(once.text)) failure = 'unpaired surrogate in output: ' + show(s);
  }
  assertEqual(failure, '', '9. fixed-seed: no runs left, totals match the scan, output well formed');

  // Dense input with the caps set: the result keeps nothing per run.
  const dense = ('a' + tags('x')).repeat(400_000);
  globalThis.gc?.();
  const before = process.memoryUsage().heapUsed;
  const cleanedDense = removeHiddenRuns(dense, { maxRuns: 0, maxDecodedLength: 0 });
  globalThis.gc?.();
  const grown = (process.memoryUsage().heapUsed - before) / 1e6;
  assertEqual(cleanedDense.text === 'a'.repeat(400_000) && cleanedDense.total === 400_000, true, '9. 400,000 runs removed and counted');
  assertEqual(grown < 6, true, '9. capped removal of 400,000 runs keeps under 6 MB (' + grown.toFixed(1) + ' MB)');
}


console.log('All hidden-text tests finished.');
