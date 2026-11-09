import assert from 'node:assert/strict';
import { validateDocMarkers } from '../scripts/gen-docs.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { revealInvisible, summonSanctifier } from '../src/index.js';

// README contracts: revealing also exposes hidden parts of emoji; purging keeps U+3000.
assert.equal(revealInvisible('\u2764\uFE0F'), '\u2764<U+FE0F>');
assert.equal(revealInvisible('\u{1F469}\u200D\u{1F4BB}'), '\u{1F469}<U+200D>\u{1F4BB}');
assert.equal(revealInvisible('\t\r\n'), '\t\r\n');
assert.equal(summonSanctifier({ normalizeSpaces: true, purgeInvisibleChars: true, nukeControls: true })('a\u3000b'), 'a\u3000b');

const readme = 'rev: v0.0.0  # a release tag\nhttps://badgen.net/static/gzip/under%203%20KiB/green\n';
for (const marker of [
    '<!-- gen:size:browser -->old<!-- /gen -->',
    '<!-- gen:bytes:browser -->old<!-- /gen -->',
    '<!-- gen:budget:browser -->old<!-- /gen -->',
    '<!-- gen:count:viramas -->old<!-- /gen -->',
    '<!-- gen:release -->old<!-- /gen -->',
    '<!-- gen:sizes:start -->\ntable\n<!-- gen:sizes:end -->',
]) assert.doesNotThrow(() => validateDocMarkers(readme + marker, 'README.md'));

for (const marker of [
    '<!-- gen:size:browser -->split\nvalue<!-- /gen -->',
    '<!-- gen:release -->missing close',
    '<!--gen:release-->old<!--/gen-->',
    '<!--  gen:release -->old<!-- /gen -->',
    '<!-- gen:unknown -->old<!-- /gen -->',
    '<!-- gen:sizes:start -->table',
    '<!-- gen:sizes:end -->',
    '<!-- gen:release -->nested <!--gen:nope--><!-- /gen -->',
]) assert.throws(() => validateDocMarkers('heading\n' + marker, 'DESIGN.md'), /DESIGN\.md:2: unhandled|DESIGN\.md:2:.*opening/);

assert.throws(() => validateDocMarkers('https://badgen.net/static/gzip/under%203%20KiB', 'README.md'), /missing rev/);
assert.throws(() => validateDocMarkers('rev: v0.0.0  # a release tag\n', 'README.md'), /missing size badge/);
const dir = mkdtempSync(join(tmpdir(), 'sanctifier-docs-'));
try {
    const cli = fileURLToPath(new URL('../bin/text-sanctifier.js', import.meta.url));
    const run = (args, input = '') => spawnSync(process.execPath, [cli, ...args], { cwd: dir, input, encoding: 'utf8' });
    writeFileSync(join(dir, 'input.txt'), 'a\u200Bb');
    for (const command of ['check', 'fix']) {
        const excluded = run([command, 'input.txt', '--exclude', 'input.txt', '--json']);
        assert.equal(excluded.status, 0, excluded.stderr);
        const report = JSON.parse(excluded.stdout);
        assert.deepEqual(report.errors, []);
        assert.equal(report.filesScanned, 0);
        assert.deepEqual(report.excluded, ['input.txt']);
    }
    const fixed = run(['fix', '-', '--json'], 'a\u3000b');
    assert.equal(fixed.status, 0);
    assert.equal(fixed.stdout, 'a\u3000b');
    assert.equal(JSON.parse(fixed.stderr).filesChanged, 0);
    const emptyAi = run(['check', '--ai-config', '--json']);
    assert.equal(emptyAi.status, 0, emptyAi.stderr);
    assert.equal(JSON.parse(emptyAi.stdout).filesScanned, 0);
    // A directory containing only skipped binary inputs is still "nothing checked".
    const binaryDir = join(dir, 'binary');
    mkdirSync(binaryDir);
    writeFileSync(join(binaryDir, 'input.bin'), Buffer.alloc(32));
    const skipped = run(['check', binaryDir, '--json']);
    assert.equal(skipped.status, 2, skipped.stderr);
    assert.equal(JSON.parse(skipped.stdout).errors[0].code, 'nothing_checked');
    const script = fileURLToPath(new URL('../scripts/gen-docs.js', import.meta.url));
    writeFileSync(join(dir, 'DESIGN.md'), 'design\n');
    for (const [text, expected] of [
        [readme + '<!--gen:release-->old<!--/gen-->', /README\.md:3:/],
        [readme + '<!-- gen:release -->split\nvalue<!-- \/gen -->', /README\.md:3:/],
        [readme + '<!-- gen:release -->missing close', /README\.md:3:/],
        ['', /missing rev/],
        ['rev: v0.0.0  # a release tag\n', /missing size badge/],
    ]) {
        writeFileSync(join(dir, 'README.md'), text);
        const result = spawnSync(process.execPath, [script], { cwd: dir, encoding: 'utf8' });
        assert.equal(result.status, 2, result.stderr);
        assert.match(result.stderr, expected);
        assert.doesNotMatch(result.stderr, /at main\b/);
    }
} finally {
    assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
    assert.ok(dir.includes('sanctifier-docs-'));
    rmSync(dir, { recursive: true, force: true });
}
console.log('docs: malformed openings, missing README anchors, valid markers checked.');
