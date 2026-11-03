// ./tests/release.test.js
//
// The pure helpers of scripts/release.js: the version bump, the CHANGELOG heading and the
// GitHub release notes.

import { nextPatch, localDate, dateChangelog, changelogSection } from '../scripts/release.js';


function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ ${message}\n  Expected: "${expected}"\n  Received: "${actual}"`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

function throws(fn) {
  try { fn(); return ''; } catch (e) { return e.message; }
}

const DASH = String.fromCharCode(0x2014);


// 1. nextPatch bumps only the last number
assertEqual(nextPatch('1.3.8'), '1.3.9', '1. 1.3.8 -> 1.3.9');
assertEqual(nextPatch('1.3.9'), '1.3.10', '1. 1.3.9 -> 1.3.10, not 1.4.0');
assertEqual(throws(() => nextPatch('1.3.8-beta.1')) !== '', true, '1. a prerelease is refused');


// 2. localDate is YYYY-MM-DD in local time
assertEqual(localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05', '2. zero-padded, local time');


// 3. dateChangelog renames "## Unreleased" and nothing else
{
  const text = `# CHANGELOG\n\n## Unreleased\n\n- a change\n\n## 1.3.8 ${DASH} 2026-11-02\n\n- old\n`;
  const out = dateChangelog(text, '1.3.9', '2026-11-03');
  assertEqual(out, text.replace('## Unreleased', `## 1.3.9 ${DASH} 2026-11-03`), '3. heading renamed, entries kept');
  assertEqual(throws(() => dateChangelog('# CHANGELOG\n\n## 1.3.8 x\n', '1.3.9', 'd')).includes('no "## Unreleased"'), true, '3. no Unreleased section: refused');
  assertEqual(throws(() => dateChangelog('## Unreleased\n\n\n## 1.3.8 x\n', '1.3.9', 'd')).includes('empty'), true, '3. empty Unreleased section: refused');
  assertEqual(throws(() => dateChangelog(`## Unreleased\n- x\n## 1.3.9 ${DASH} d\n`, '1.3.9', 'd')).includes('already'), true, '3. version already in the CHANGELOG: refused');
  assertEqual(dateChangelog('## Unreleased\n- last section\n', '1.3.9', 'd'), `## 1.3.9 ${DASH} d\n- last section\n`, '3. Unreleased as the last section');
}


// 4. changelogSection gives one release's entries, without the heading
{
  const text = `# CHANGELOG\n\n## 1.3.9 ${DASH} 2026-11-03\n\n- new\n- also new\n\n## 1.3.8 ${DASH} 2026-11-02\n\n- old\n`;
  assertEqual(changelogSection(text, '1.3.9'), '- new\n- also new\n', '4. entries of the newest release');
  assertEqual(changelogSection(text, '1.3.8'), '- old\n', '4. the last section');
  assertEqual(throws(() => changelogSection(text, '1.3.1')).includes('no 1.3.1 section'), true, '4. missing version: refused');
  assertEqual(throws(() => changelogSection(`## 1.3.9 ${DASH} d\n\n## 1.3.8 x\n`, '1.3.9')).includes('empty'), true, '4. empty section: refused');
  assertEqual(throws(() => changelogSection('## 1.3.10 x\n- y\n', '1.3.1')).includes('no 1.3.1'), true, '4. 1.3.1 does not match 1.3.10');
}


console.log('All release tests finished.');
