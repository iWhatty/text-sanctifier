// ./tests/cli.test.js
//
// Runs bin/text-sanctifier.js as a child process against temp directories.
// Characters are built with String.fromCharCode so this file holds no raw
// invisible characters.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';


function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.error(`❌ ${message}\n  Expected: "${expected}"\n  Received: "${actual}"`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

const ch = (cp) => String.fromCharCode(cp);
const BOM = ch(0xFEFF);
const ZWSP = ch(0x200B);
const RLO = ch(0x202E);
const BEL = ch(0x07);
const CRLF = ch(0x0D) + ch(0x0A);

const BIN = fileURLToPath(new URL('../bin/text-sanctifier.js', import.meta.url));
const PKG = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/**
 * @param {string[]} args
 * @param {{ cwd: string, input?: string }} opts
 */
function run(args, { cwd, input = '' }) {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, input, encoding: 'utf8' });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const roots = [];
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'text-sanctifier-cli-'));
  roots.push(dir);
  return dir;
}

const read = (dir, name) => readFileSync(join(dir, name), 'utf8');
const lines = (s) => s.split(/\r?\n/).filter(Boolean);

const gitAvailable = !spawnSync('git', ['--version']).error;


try {
  // --- Usage ---
  {
    const cwd = tempDir();
    assertEqual(run(['--version'], { cwd }).stdout.trim(), PKG.version, '--version prints the package version');

    const help = run(['--help'], { cwd });
    assertEqual(help.code === 0 && help.stdout.includes('text-sanctifier check'), true, '--help prints usage, exit 0');

    assertEqual(run(['lint', 'x'], { cwd }).code, 2, 'unknown command exits 2');
    assertEqual(run(['check', '--bogus', 'x'], { cwd }).code, 2, 'unknown option exits 2');
    assertEqual(run(['check', '--purge-invisible', 'x'], { cwd }).code, 2, 'fix-only flag on check exits 2');
    assertEqual(run(['check', '--max-findings', '-1', 'x'], { cwd }).code, 2, 'negative --max-findings exits 2');

    const missing = run(['check', 'nope.txt'], { cwd });
    assertEqual(missing.code, 2, 'missing path exits 2');
    assertEqual(missing.stderr.includes('nope.txt'), true, 'missing path is named on stderr');
  }

  // --- check ---
  {
    const cwd = tempDir();
    writeFileSync(join(cwd, 'clean.txt'), 'all good\n');
    writeFileSync(join(cwd, 'dirty.txt'), `line one\nab${ZWSP}c\nx${RLO}y${BEL}\n`);

    const clean = run(['check', 'clean.txt'], { cwd });
    assertEqual(clean.code, 0, 'check: clean file exits 0');
    assertEqual(clean.stdout.trim(), 'No invisible or control characters in 1 file.', 'check: clean summary');

    const dirty = run(['check', 'clean.txt', 'dirty.txt'], { cwd });
    assertEqual(dirty.code, 1, 'check: findings exit 1');
    assertEqual(
      lines(dirty.stdout).join('|'),
      [
        'dirty.txt:2:3  U+200B  zero_width',
        'dirty.txt:3:2  U+202E  bidi_control',
        'dirty.txt:3:4  U+0007  c0_control',
        '3 findings in 1 of 2 files.',
      ].join('|'),
      'check: file:line:col report'
    );

    const json = run(['check', '--json', 'clean.txt', 'dirty.txt'], { cwd });
    const report = JSON.parse(json.stdout);
    assertEqual(json.code, 1, 'check --json: exit 1');
    assertEqual(report.total, 3, 'check --json: total');
    assertEqual(report.filesScanned, 2, 'check --json: filesScanned');
    assertEqual(report.files.length, 1, 'check --json: only files with findings are listed');
    assertEqual(report.files[0].path, 'dirty.txt', 'check --json: path');
    assertEqual(report.files[0].counts.zero_width, 1, 'check --json: per-category counts');
    assertEqual(
      JSON.stringify(report.files[0].findings[0]),
      JSON.stringify({ offset: 11, line: 2, column: 3, codePoint: 0x200B, category: 'zero_width' }),
      'check --json: findings are inspectTextDetailed findings'
    );

    const capped = run(['check', '--max-findings=1', 'dirty.txt'], { cwd });
    assertEqual(lines(capped.stdout)[1], 'dirty.txt: 2 more not listed (--max-findings)', 'check --max-findings: truncation note');

    const cappedJson = JSON.parse(run(['check', '--json', '--max-findings', '0', 'dirty.txt'], { cwd }).stdout);
    assertEqual(cappedJson.files[0].findings.length === 0 && cappedJson.files[0].truncated, true, 'check --max-findings 0: counts only');
  }

  // --- BOM ---
  {
    const cwd = tempDir();
    writeFileSync(join(cwd, 'bom.txt'), `${BOM}hello\n`);
    writeFileSync(join(cwd, 'midbom.txt'), `hel${BOM}lo\n`);

    assertEqual(run(['check', 'bom.txt'], { cwd }).code, 0, 'check: BOM at offset 0 is not reported');
    assertEqual(lines(run(['check', '--strip-bom', 'bom.txt'], { cwd }).stdout)[0], 'bom.txt:1:1  U+FEFF  bom', 'check --strip-bom: leading BOM reported');
    assertEqual(lines(run(['check', 'midbom.txt'], { cwd }).stdout)[0], 'midbom.txt:1:4  U+FEFF  bom', 'check: BOM elsewhere is reported');

    const json = JSON.parse(run(['check', '--json', '--strip-bom', 'bom.txt', 'midbom.txt'], { cwd }).stdout);
    assertEqual(json.total, 2, 'check --json --strip-bom: both BOMs counted');
    const plain = JSON.parse(run(['check', '--json', 'bom.txt', 'midbom.txt'], { cwd }).stdout);
    assertEqual(plain.total + '/' + plain.files[0].counts.bom, '1/1', 'check --json: leading BOM left out of counts');
  }

  // --- stdin ---
  {
    const cwd = tempDir();
    const piped = run(['check'], { cwd, input: `a${ZWSP}b` });
    assertEqual(piped.code + ' ' + lines(piped.stdout)[0], '1 <stdin>:1:2  U+200B  zero_width', 'check: no paths reads piped stdin');

    const dash = run(['check', '-'], { cwd, input: 'fine' });
    assertEqual(dash.code, 0, 'check -: clean stdin exits 0');

    const fixed = run(['fix', '-'], { cwd, input: `${BOM}a${ZWSP}b${CRLF}` });
    assertEqual(fixed.stdout, `${BOM}ab${CRLF}`, 'fix -: cleaned text on stdout, BOM and CRLF kept');
    assertEqual(fixed.stderr.includes('fixed <stdin>: removed 1 (zero_width 1)'), true, 'fix -: report on stderr');
  }

  // --- binary and non-UTF-8 ---
  {
    const cwd = tempDir();
    mkdirSync(join(cwd, 'd'));
    writeFileSync(join(cwd, 'd', 'img.bin'), Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x00, 0x01, 0x02]));
    writeFileSync(join(cwd, 'd', 'latin1.txt'), Buffer.from([0x63, 0x61, 0x66, 0xE9]));
    writeFileSync(join(cwd, 'd', 'ok.txt'), 'ok\n');

    const dir = run(['check', '--json', 'd'], { cwd });
    const report = JSON.parse(dir.stdout);
    assertEqual(dir.code, 0, 'check dir: binary files do not fail the run');
    assertEqual(report.filesScanned, 1, 'check dir: only the text file is scanned');
    assertEqual(
      report.skipped.map((s) => `${s.path.replace(/\\/g, '/')}:${s.reason}`).join(','),
      'd/img.bin:binary,d/latin1.txt:not UTF-8',
      'check dir: skipped files listed with reasons'
    );
    assertEqual(run(['check', 'd'], { cwd }).stderr, '', 'check dir: skipped files are silent in text mode');
    assertEqual(run(['check', join('d', 'img.bin')], { cwd }).stderr.includes('skipped (binary)'), true, 'check: named binary file noted on stderr');

    writeFileSync(join(cwd, 'd', 'latin1.txt'), Buffer.from([0x63, 0x61, 0x66, 0xE9, 0xA0]));
    run(['fix', 'd'], { cwd });
    assertEqual(readFileSync(join(cwd, 'd', 'latin1.txt')).toString('hex'), '636166e9a0', 'fix: non-UTF-8 file left untouched');
  }

  // --- fix ---
  {
    const cwd = tempDir();
    const dirty = `${BOM}a${ZWSP}b${CRLF}c${RLO}d${BEL}${CRLF}`;
    writeFileSync(join(cwd, 'f.txt'), dirty);

    const dry = run(['fix', '--dry-run', 'f.txt'], { cwd });
    assertEqual(dry.code, 1, 'fix --dry-run: pending changes exit 1');
    assertEqual(read(cwd, 'f.txt'), dirty, 'fix --dry-run: file untouched');
    assertEqual(lines(dry.stdout)[0], 'would fix f.txt: removed 3 (bidi_control 1, zero_width 1, c0_control 1)', 'fix --dry-run: report');

    const fixed = run(['fix', 'f.txt'], { cwd });
    assertEqual(fixed.code, 0, 'fix: exit 0 after writing');
    assertEqual(read(cwd, 'f.txt'), `${BOM}ab${CRLF}cd${CRLF}`, 'fix: default purges invisibles and controls, keeps BOM and CRLF');
    assertEqual(run(['fix', '--dry-run', 'f.txt'], { cwd }).code, 0, 'fix --dry-run: nothing pending exits 0');

    writeFileSync(join(cwd, 'g.txt'), `${BOM}a${ZWSP}b${CRLF}`);
    run(['fix', '--normalize-newlines', 'g.txt'], { cwd });
    assertEqual(read(cwd, 'g.txt'), `${BOM}a${ZWSP}b\n`, 'fix --normalize-newlines: only newlines change');

    const json = JSON.parse(run(['fix', '--json', '--strip-bom', '--purge-invisible', 'g.txt'], { cwd }).stdout);
    assertEqual(read(cwd, 'g.txt'), 'ab\n', 'fix --strip-bom: leading BOM removed');
    assertEqual(
      JSON.stringify(json.files[0]),
      JSON.stringify({ path: 'g.txt', removed: { zero_width: 1, bom: 1 }, removedTotal: 2, newlinesNormalized: false }),
      'fix --json: per-file removed counts'
    );
  }

  // --- globs outside git ---
  {
    const cwd = tempDir();
    mkdirSync(join(cwd, 'a', 'b'), { recursive: true });
    mkdirSync(join(cwd, 'node_modules'));
    writeFileSync(join(cwd, 'top.md'), `x${ZWSP}\n`);
    writeFileSync(join(cwd, 'a', 'b', 'deep.md'), `x${ZWSP}\n`);
    writeFileSync(join(cwd, 'a', 'b', 'deep.txt'), `x${ZWSP}\n`);
    writeFileSync(join(cwd, 'node_modules', 'dep.md'), `x${ZWSP}\n`);

    const paths = (args) => JSON.parse(run(['check', '--json', ...args], { cwd }).stdout).files.map((f) => f.path).join(',');
    assertEqual(paths(['**/*.md']), 'a/b/deep.md,top.md', 'glob **/*.md: recursive, skips node_modules');
    assertEqual(paths(['*.md']), 'top.md', 'glob *.md: top level only');
    assertEqual(paths(['a/**/*.{md,txt}']), 'a/b/deep.md,a/b/deep.txt', 'glob braces');
    assertEqual(paths(['.']), 'a/b/deep.md,a/b/deep.txt,top.md', 'directory walk skips node_modules');
  }

  // --- .gitignore ---
  if (gitAvailable) {
    const cwd = tempDir();
    spawnSync('git', ['init', '-q'], { cwd });
    mkdirSync(join(cwd, 'build'));
    writeFileSync(join(cwd, '.gitignore'), 'build/\nignored.txt\n');
    writeFileSync(join(cwd, 'kept.txt'), `x${ZWSP}\n`);
    writeFileSync(join(cwd, 'ignored.txt'), `x${ZWSP}\n`);
    writeFileSync(join(cwd, 'build', 'out.txt'), `x${ZWSP}\n`);

    const paths = (args) => JSON.parse(run(['check', '--json', ...args], { cwd }).stdout).files.map((f) => f.path).join(',');
    assertEqual(paths(['.']), 'kept.txt', 'git: directory scan honours .gitignore');
    assertEqual(paths(['*.txt']), 'kept.txt', 'git: glob honours .gitignore');
    assertEqual(paths(['ignored.txt']), 'ignored.txt', 'git: a file named explicitly is checked anyway');
  } else {
    console.log('⚠️  git not found; .gitignore tests skipped');
  }
} finally {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true });
}
