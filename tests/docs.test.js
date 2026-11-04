import assert from 'node:assert/strict';
import { validateDocMarkers } from '../scripts/gen-docs.js';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
