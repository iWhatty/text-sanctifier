// scripts/release.js
//
// The release steps that are the same every time, so none of them is done by hand.
//
//   npm run release:prep                 bump the patch number, date the CHANGELOG, run `npm run gen`
//                                        and `npm run ci`, commit "chore(release): X.Y.Z" and push
//   npm run release:prep -- --dry-run    check everything and print the plan; change nothing
//   npm publish --access public          the maintainer, with npm two-factor credentials
//   npm run release:verify               wait for npm, check the release matches its commit,
//                                        tag vX.Y.Z on that commit and push the tag
//   npm run release:verify -- 1.3.8 --no-tag
//
// While work lands, CHANGELOG entries go under "## Unreleased"; prep turns that heading
// into "## X.Y.Z — YYYY-MM-DD" (local date) and refuses to release without entries.

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const PACKAGE = 'text-sanctifier';
const DASH = String.fromCharCode(0x2014);
const NPM_WAIT_MS = 10 * 60 * 1000;

/** @param {string} version */
export function nextPatch(version) {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (!m) throw new Error(`not a release version: ${version}`);
    return `${m[1]}.${m[2]}.${Number(m[3]) + 1}`;
}

/** YYYY-MM-DD in local time. */
export function localDate(d = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Renames the "## Unreleased" section of a CHANGELOG to the release.
 * @param {string} text
 * @param {string} version
 * @param {string} date
 */
export function dateChangelog(text, version, date) {
    const lines = text.split('\n');
    if (lines.some((l) => l.startsWith(`## ${version} `))) throw new Error(`CHANGELOG.md already has a ${version} section.`);
    const start = lines.findIndex((l) => l.trim() === '## Unreleased');
    if (start < 0) throw new Error('CHANGELOG.md has no "## Unreleased" section; put the entries for this release under one.');
    let end = start + 1;
    while (end < lines.length && !lines[end].startsWith('## ')) end++;
    if (!lines.slice(start + 1, end).some((l) => l.trim())) throw new Error('the "## Unreleased" section of CHANGELOG.md is empty.');
    lines[start] = `## ${version} ${DASH} ${date}`;
    return lines.join('\n');
}

/** @param {string} cmd */
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
/** @param {string} cmd */
const run = (cmd) => { execSync(cmd, { stdio: 'inherit' }); };
/** @param {string} file */
const readLf = (file) => readFileSync(resolve(file), 'utf8').replace(/\r\n/g, '\n');

/** @param {string} message @returns {never} */
function fail(message) {
    console.error(`release: ${message}`);
    process.exit(1);
}

function packInfo() {
    const [pack] = JSON.parse(sh('npm pack --dry-run --json --ignore-scripts'));
    return { shasum: pack.shasum, files: pack.entryCount };
}

/** @param {boolean} dryRun */
function prep(dryRun) {
    if (sh('git rev-parse --abbrev-ref HEAD') !== 'main') fail('not on main.');
    if (sh('git status --porcelain')) fail('the working tree has changes; commit or stash them first.');
    sh('git fetch -q origin');
    if (sh('git rev-parse HEAD') !== sh('git rev-parse origin/main')) fail('main and origin/main differ; pull or push first.');

    const current = JSON.parse(readLf('package.json')).version;
    const published = sh(`npm view ${PACKAGE} version`);
    if (current !== published) fail(`package.json has ${current} but npm has ${published}; is a release already prepared and not yet published?`);

    const version = nextPatch(published);
    const date = localDate();
    let changelog;
    try { changelog = dateChangelog(readLf('CHANGELOG.md'), version, date); } catch (e) { fail(/** @type {Error} */ (e).message); }

    console.log(`release: ${published} -> ${version}, dated ${date}`);
    if (dryRun) {
        console.log('release: dry run; nothing changed. Steps: npm version, CHANGELOG heading, npm run gen, npm run ci, commit, push.');
        return;
    }

    run(`npm version ${version} --no-git-tag-version`);
    writeFileSync(resolve('CHANGELOG.md'), changelog);
    run('npm run gen');
    run('npm run ci');
    const pack = packInfo();
    run('git add -A');
    run(`git commit -q -m "chore(release): ${version}"`);
    run('git push -q origin main');

    console.log(`\nrelease: ${version} prepared and pushed as ${sh('git rev-parse --short HEAD')}`);
    console.log(`release: local pack ${pack.shasum}, ${pack.files} files`);
    console.log('release: next, the maintainer runs `npm publish --access public`, then `npm run release:verify`.');
}

/** @param {string | undefined} versionArg @param {boolean} tag */
async function verify(versionArg, tag) {
    const version = versionArg || JSON.parse(readLf('package.json')).version;
    const deadline = Date.now() + NPM_WAIT_MS;
    let meta;
    for (;;) {
        try {
            meta = JSON.parse(sh(`npm view ${PACKAGE}@${version} version gitHead dist.shasum dist.fileCount --json`));
            break;
        } catch {
            if (Date.now() > deadline) fail(`${version} is still not on npm after ${NPM_WAIT_MS / 60000} minutes.`);
            console.log(`release: waiting for ${version} to appear on npm...`);
            await new Promise((r) => setTimeout(r, 15000));
        }
    }

    const commit = meta.gitHead;
    if (!commit) fail('npm has no gitHead for this release; was it published from a clean git checkout?');
    sh('git fetch -q origin --tags');
    try { sh(`git merge-base --is-ancestor ${commit} origin/main`); } catch { fail(`gitHead ${commit} is not on origin/main.`); }
    const atCommit = JSON.parse(sh(`git show ${commit}:package.json`)).version;
    if (atCommit !== version) fail(`package.json at gitHead ${commit} has ${atCommit}, not ${version}.`);
    const report = [`npm has ${version}`, `gitHead ${commit.slice(0, 7)} is on origin/main, with ${version} in package.json`];

    if (sh('git rev-parse HEAD') === commit && !sh('git status --porcelain')) {
        const pack = packInfo();
        if (pack.shasum !== meta['dist.shasum'] || pack.files !== meta['dist.fileCount']) {
            fail(`npm has shasum ${meta['dist.shasum']} with ${meta['dist.fileCount']} files; a local pack has ${pack.shasum} with ${pack.files}. Run \`npm run ci\` (it builds dist/ and the types) and verify again; if it still differs, the published files are not this commit's.`);
        }
        report.push(`shasum ${pack.shasum} and ${pack.files} files match a local pack`);
    } else {
        report.push('shasum not compared: HEAD is not the release commit');
    }

    const tagName = `v${version}`;
    let tagged = '';
    try { tagged = sh(`git rev-list -n 1 refs/tags/${tagName}`); } catch { /* no such tag */ }
    if (tagged && tagged !== commit) fail(`tag ${tagName} is at ${tagged}, not ${commit}.`);
    if (!tag) {
        report.push(tagged ? `tag ${tagName} already on it` : `not tagged (--no-tag)`);
    } else {
        if (!tagged) run(`git tag ${tagName} ${commit}`);
        if (!sh(`git ls-remote --tags origin refs/tags/${tagName}`)) run(`git push -q origin ${tagName}`);
        report.push(tagged ? `tag ${tagName} already on it, and on origin` : `tagged ${tagName} and pushed it`);
    }

    console.log(report.map((line) => `release: ${line}`).join('\n'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [command, ...rest] = process.argv.slice(2);
    if (command === 'prep') prep(rest.includes('--dry-run'));
    else if (command === 'verify') await verify(rest.find((a) => !a.startsWith('--')), !rest.includes('--no-tag'));
    else fail('usage: node scripts/release.js prep [--dry-run] | verify [X.Y.Z] [--no-tag]');
}
