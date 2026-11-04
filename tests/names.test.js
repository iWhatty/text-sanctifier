// Offline integration tests. All names and list files belong to temporary repos.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/check-names.js', import.meta.url));
const zero = '0'.repeat(40);

function fixture(label, list, exercise) {
    const dir = mkdtempSync(join(tmpdir(), 'sanctifier-names-'));
    const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const write = (file, text) => writeFileSync(join(dir, file), text);
    const commit = (message = 'fixture') => { git('add', '-A'); git('commit', '-qm', message); return git('rev-parse', 'HEAD'); };
    const check = (expected, input) => {
        const args = input === undefined ? [] : ['--pre-push'];
        const result = spawnSync(process.execPath, [script, ...args], { cwd: dir, input, encoding: 'utf8' });
        assert.equal(result.status, expected, `${label}: ${result.stdout}${result.stderr}`);
        assert.doesNotMatch(result.stderr, /at (?:main|execFileSync)\b/);
        return result;
    };
    try {
        git('init', '-q', '-b', 'main');
        git('config', 'user.name', 'Fixture');
        git('config', 'user.email', 'fixture@example.invalid');
        git('config', 'commit.gpgsign', 'false');
        git('config', 'core.hooksPath', 'disabled-hooks');
        write('clean.txt', 'clean\n');
        const base = commit();
        git('update-ref', 'refs/remotes/origin/main', base);
        if (list !== null) write('.git/info/private-names', list);
        exercise({ git, write, commit, check, base, remove: (file) => rmSync(join(dir, file)) });
        console.log(`names: ${label}`);
    } finally {
        assert.equal(dirname(resolve(dir)), resolve(tmpdir()));
        assert.ok(dir.includes('sanctifier-names-'));
        rmSync(dir, { recursive: true, force: true });
    }
}

fixture('missing list skips', null, ({ check }) => check(0));
fixture('empty list skips', '# comment\n\n', ({ check }) => check(0));
fixture('whole words, case insensitive', 'acmeprivate', ({ write, check }) => {
    write('clean.txt', 'FooAcmePrivateServer acmeprivate_suffix\n'); check(0);
    write('clean.txt', 'Use ACMEPRIVATE.\n'); check(1);
});
fixture('substring opt-in', '*acmeprivate', ({ write, check }) => {
    write('clean.txt', 'FooAcmePrivateServer\n'); check(1);
});
fixture('regex punctuation escaped', 'acme.private', ({ write, check }) => {
    write('clean.txt', 'acmeXprivate\n'); check(0);
    write('clean.txt', 'acme.private\n'); check(1);
});
fixture('phrase crosses line break', 'acme private', ({ write, check }) => {
    write('clean.txt', 'ACME\r\nprivate\n'); check(1);
});
fixture('working path', '*acmeprivate', ({ write, check }) => {
    write('FooAcmePrivateServer.txt', 'clean\n'); check(1);
});
fixture('staged content survives working edit', 'acmeprivate', ({ write, git, check }) => {
    write('clean.txt', 'acmeprivate\n'); git('add', 'clean.txt');
    write('clean.txt', 'clean\n'); check(1);
});
fixture('staged phrase across lines', 'acme private', ({ write, git, check }) => {
    write('clean.txt', 'acme\nprivate\n'); git('add', 'clean.txt');
    write('clean.txt', 'clean\n'); check(1);
});
fixture('staged path survives working deletion', '*acmeprivate', ({ write, git, check, remove }) => {
    write('acmeprivate.txt', 'clean\n'); git('add', 'acmeprivate.txt');
    // Tracked index entry remains even though the working file is gone.
    remove('acmeprivate.txt'); check(1);
});
fixture('unpushed message and percent formats', 'acmeprivate', ({ write, commit, check }) => {
    write('clean.txt', 'changed\n'); commit('acmeprivate %PATH% %h'); check(1);
});
fixture('removed content still scanned in both modes', 'acmeprivate', ({ write, commit, check, base }) => {
    write('clean.txt', 'acmeprivate\n'); commit();
    write('clean.txt', 'clean\n'); const head = commit();
    check(1);
    check(1, `refs/heads/main ${head} refs/heads/main ${base}\n`);
    check(1, `refs/heads/main ${head} refs/heads/main ${'f'.repeat(40)}\n`);
    check(1, `refs/heads/new ${head} refs/heads/new ${zero}\n`);
    check(0, `refs/heads/deleted ${zero} refs/heads/deleted ${base}\n`);
});
fixture('historical path', '*acmeprivate', ({ write, git, commit, check, base }) => {
    write('FooAcmePrivateServer.txt', 'clean\n'); commit();
    git('rm', 'FooAcmePrivateServer.txt'); const head = commit();
    check(1); check(1, `refs/heads/main ${head} refs/heads/main ${base}\n`);
});
fixture('historical phrase', 'acme private', ({ write, commit, check, base }) => {
    write('clean.txt', 'acme\nprivate\n'); commit();
    write('clean.txt', 'clean\n'); const head = commit();
    check(1); check(1, `refs/heads/main ${head} refs/heads/main ${base}\n`);
});
fixture('added content beginning with plus signs', 'acmeprivate', ({ write, commit, check }) => {
    write('clean.txt', '++acmeprivate\n'); commit();
    write('clean.txt', 'clean\n'); commit(); check(1);
});
fixture('merge resolution additions', 'acmeprivate', ({ write, git, commit, check }) => {
    git('checkout', '-qb', 'topic');
    write('clean.txt', 'topic\n'); commit();
    git('checkout', '-q', 'main');
    write('other.txt', 'main\n'); commit();
    git('merge', '--no-ff', '--no-commit', 'topic');
    write('clean.txt', 'acmeprivate\n'); commit('merge fixture');
    write('clean.txt', 'clean\n'); commit(); check(1);
});
fixture('published history excluded', 'acmeprivate', ({ write, commit, git, check }) => {
    write('clean.txt', 'acmeprivate\n'); commit();
    write('clean.txt', 'clean\n'); const head = commit();
    git('update-ref', 'refs/remotes/origin/main', head);
    check(0); check(0, `refs/heads/main ${head} refs/heads/main ${head}\n`);
});
