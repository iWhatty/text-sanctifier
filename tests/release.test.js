// ./tests/release.test.js
//
// The pure helpers of scripts/release.js: the version bump, the CHANGELOG heading and the
// GitHub release notes.

import { nextPatch, localDate, dateChangelog, changelogSection, validGitHead, requirePrepSetup, requirePublishState, requireShasumForTag, checkPublish, prepareRelease, prep } from '../scripts/release.js';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';


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


// All commands below are fakes: no network, bumps, tags, pushes or commits.
const original = 'a'.repeat(40);
assert.equal(validGitHead(original), true);
for (const head of [undefined, '', 'a'.repeat(39), 'g'.repeat(40), `${original};echo bad`, 123]) {
  assert.equal(validGitHead(head), false);
}

for (const failure of ['npm run ci', 'npm version', 'date CHANGELOG', 'npm run gen', 'post-bump npm run ci', 'npm pack', 'git add', 'git commit', 'git push', null]) {
  const events = [];
  let ciRuns = 0;
  let committed = false;
  const stop = (step) => { events.push(step); if (step === failure) throw new Error('fake stack must not escape'); };
  const action = () => prepareRelease('0.0.1', 'dated', {
    execute(command) {
      const step = command === 'npm run ci' ? (++ciRuns === 1 ? command : 'post-bump npm run ci') :
        command.startsWith('npm version') ? 'npm version' : command.startsWith('git commit') ? 'git commit' : command.startsWith('git push') ? 'git push' : command.startsWith('git add') ? 'git add' : command;
      stop(step);
      if (step === 'git commit') committed = true;
    },
    query(command) {
      if (command === 'git rev-parse HEAD') return committed ? 'b'.repeat(40) : original;
      if (command === 'git status --short') return ' M package.json\n M README.md';
      if (command === 'git status --porcelain') return '';
      throw new Error(`unexpected query ${command}`);
    },
    write() { stop('date CHANGELOG'); },
    pack() { stop('npm pack'); return { shasum: 'fake', files: 1 }; },
  });
  if (failure === null) {
    assert.deepEqual(action(), { shasum: 'fake', files: 1 });
    assert.deepEqual(events, ['npm run ci', 'npm version', 'date CHANGELOG', 'npm run gen', 'post-bump npm run ci', 'npm pack', 'git add', 'git commit', 'git push']);
  } else {
    const message = throws(action);
    if (failure === 'npm run ci') {
      assert.match(message, /pre-bump.*version unchanged/);
      assert.deepEqual(events, ['npm run ci']);
    } else {
      assert.ok(message.startsWith(`${failure} failed.`));
      assert.ok(message.includes(`Commit already made: ${failure === 'git push' ? 'yes' : 'no'}`));
      assert.ok(message.includes(`git reset --hard ${original}`));
      assert.match(message, / M package.json\n M README.md/);
      assert.doesNotMatch(message, /fake stack/);
    }
  }
}

// Check existence and byte length only: the real list is never opened here.
const setupQuery = (command) => command.includes('hooksPath') ? 'scripts/hooks' : '.git';
assert.doesNotThrow(() => requirePrepSetup(setupQuery, () => ({ isFile: () => true, size: 1 })));
for (const stat of [() => { throw new Error('missing'); }, () => ({ isFile: () => true, size: 0 })]) {
  assert.throws(() => requirePrepSetup(setupQuery, stat), /create a nonempty/);
}
assert.throws(() => requirePrepSetup(() => '.git', () => ({ isFile: () => true, size: 1 })), /npm run hooks:install/);

let setupCalls = 0;
prep(true, {
  setup() { setupCalls++; },
  query(command) {
    if (command.includes('--abbrev-ref')) return 'main';
    if (command.includes('status') || command.includes('fetch')) return '';
    if (command.startsWith('npm view')) return '0.0.0';
    return original;
  },
  read(file) { return file === 'package.json' ? '{"version":"0.0.0"}' : '## Unreleased\n- entry\n'; },
  prepare() { assert.fail('dry run must not run CI or mutate'); },
});
assert.equal(setupCalls, 1);
const releaseDir = mkdtempSync(join(tmpdir(), 'sanctifier-release-'));
try {
  execFileSync('git', ['init', '-q'], { cwd: releaseDir });
  const script = fileURLToPath(new URL('../scripts/release.js', import.meta.url));
  writeFileSync(join(releaseDir, 'package.json'), '{"version":"0.0.0"}');
  for (const list of [null, '', 'acmeprivate\n']) {
    if (list !== null) writeFileSync(join(releaseDir, '.git/info/private-names'), list);
    execFileSync('git', ['config', 'core.hooksPath', 'wrong-hooks'], { cwd: releaseDir });
    const result = spawnSync(process.execPath, [script, 'prep', '--dry-run'], { cwd: releaseDir, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, list ? /npm run hooks:install/ : /create a nonempty/);
    assert.doesNotMatch(result.stderr, /at (?:prep|execSync)\b/);
    assert.equal(readFileSync(join(releaseDir, 'package.json'), 'utf8'), '{"version":"0.0.0"}');
  }
} finally {
  assert.equal(dirname(resolve(releaseDir)), resolve(tmpdir()));
  assert.ok(releaseDir.includes('sanctifier-release-'));
  rmSync(releaseDir, { recursive: true, force: true });
}

const state = {
  'git rev-parse --abbrev-ref HEAD': 'main', 'git status --porcelain': '',
  'git fetch -q origin': '', 'git rev-parse HEAD': original, 'git rev-parse origin/main': original,
  'git log -1 --format=%s': 'chore(release): 0.0.1', 'git log -1 --format=%H -- package.json': original,
  'npm view text-sanctifier versions --json': '["0.0.0"]',
};
const readPublish = (file) => file === 'package.json' ? '{"version":"0.0.1"}' : `## 0.0.1 ${DASH} 2026-01-01\n`;
const queryPublish = (command) => { assert.ok(command in state, command); return state[command]; };
assert.doesNotThrow(() => requirePublishState(queryPublish, readPublish));
assert.throws(() => requirePublishState((cmd) => cmd === 'git log -1 --format=%s' ? 'other' : cmd === 'git log -1 --format=%H -- package.json' ? 'old' : queryPublish(cmd), readPublish), /release commit/);
assert.doesNotThrow(() => requirePublishState((cmd) => cmd === 'git log -1 --format=%s' ? 'other' : queryPublish(cmd), readPublish));
assert.throws(() => requireShasumForTag(true, false), /shasum not compared/);
assert.doesNotThrow(() => requireShasumForTag(false, false));
for (const [command, value, message] of [
  ['git rev-parse --abbrev-ref HEAD', 'topic', /requires main/],
  ['git status --porcelain', ' M file', /clean working tree/],
  ['git rev-parse origin/main', 'b'.repeat(40), /HEAD must equal/],
  ['npm view text-sanctifier versions --json', '["0.0.1"]', /already on npm/],
  ['npm view text-sanctifier versions --json', 'garbage', /npm version lookup failed/],
]) {
  assert.throws(() => requirePublishState((cmd) => cmd === command ? value : queryPublish(cmd), readPublish), message);
}
for (const command of ['git fetch -q origin', 'npm view text-sanctifier versions --json']) {
  assert.throws(() => requirePublishState((cmd) => { if (cmd === command) throw new Error('offline'); return queryPublish(cmd); }, readPublish), /failed; check network/);
}
assert.throws(() => requirePublishState(queryPublish, (file) => file === 'CHANGELOG.md' ? '## Unreleased\n' : readPublish(file)), /dated CHANGELOG heading/);
const builds = [];
checkPublish(queryPublish, readPublish, (command) => builds.push(command));
assert.deepEqual(builds, ['npm run build', 'npm run build:types']);
assert.throws(() => checkPublish(queryPublish, readPublish, () => { throw new Error('build error'); }), /build failed; publish stopped/);
console.log('All release tests finished.');
