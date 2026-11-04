import assert from 'node:assert/strict';
import { checkRepository } from '../scripts/check-repo.js';

const branch = String.fromCharCode(0x251c, 0x2500, 0x2500);
const bar = String.fromCharCode(0x2502);
const layout = `${branch} src/\n${bar}   ${branch} index.js\n${branch} scripts/\n${branch} tests/\n${bar}   ${branch} repo.test.js\n${bar}   ${branch} types/\n`;
assert.deepEqual(checkRepository(['src/index.js', 'scripts/nested/check.js', 'tests/types/consumer.ts', 'tests/repo.test.js'], layout, 'node tests/repo.test.js'), []);
assert.deepEqual(checkRepository(['src/new.js'], layout, ''), ['src/new.js missing from ProjectLayout.txt']);
assert.deepEqual(checkRepository(['tests/new.test.js'], layout, 'node tests/new.test.js.extra'), [
    'tests/new.test.js missing from ProjectLayout.txt', 'tests/new.test.js missing from package.json test script',
]);
assert.deepEqual(checkRepository(['tests/repo.test.js'], layout, 'node tests/repo.test.js'), []);
console.log('repo: missing paths, grouped directories and omitted tests checked.');
