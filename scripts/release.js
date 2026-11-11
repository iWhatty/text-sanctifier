// scripts/release.js
//
// The release steps that are the same every time, so none of them is done by hand.
//
//   npm run release:prep                 install locked dependencies, bump the patch number and lockfile, date the CHANGELOG, run `npm run gen`
//                                        and `npm run ci`, commit "chore(release): X.Y.Z" and push
//   npm run release:prep -- --dry-run    check everything and print the plan; change nothing
//   npm publish --access public          the maintainer, with npm two-factor credentials
//   npm run release:verify               wait for npm, check the release matches its commit,
//                                        tag vX.Y.Z on that commit and push the tag
//   npm run release:verify -- 1.3.8 --no-tag
//   npm run release:verify -- --github-release   also create the GitHub release (needs `gh`),
//                                        with the version's CHANGELOG section as its notes
//
// While work lands, CHANGELOG entries go under "## Unreleased"; prep turns that heading
// into "## X.Y.Z — YYYY-MM-DD" (local date) and refuses to release without entries.

import { execSync } from 'child_process';
import { readFileSync, rmSync, writeFileSync, statSync } from 'fs';
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

/**
 * The entries of a release's CHANGELOG section, without its heading: the GitHub release notes.
 * @param {string} text
 * @param {string} version
 */
export function changelogSection(text, version) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => l.startsWith(`## ${version} `));
    if (start < 0) throw new Error(`CHANGELOG.md has no ${version} section.`);
    let end = start + 1;
    while (end < lines.length && !lines[end].startsWith('## ')) end++;
    const notes = lines.slice(start + 1, end).join('\n').trim();
    if (!notes) throw new Error(`the ${version} section of CHANGELOG.md is empty.`);
    return notes + '\n';
}

/** @param {string} cmd */
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
/** @param {string} cmd */
const run = (cmd) => { execSync(cmd, { stdio: 'inherit' }); };
/** @param {string} file */
const readLf = (file) => readFileSync(resolve(file), 'utf8').replace(/\r\n/g, '\n');

/** @param {string} message @returns {never} */
function fail(message) {
    throw new Error(message);
}

export function validGitHead(value) {
    return typeof value === 'string' && /^[a-f\d]{40}$/i.test(value);
}

export function requireDatedHeading(text, version) {
    nextPatch(version); // Validate before constructing a pattern or shell command.
    if (!new RegExp(`^## ${version.replace(/\./g, '\\.')} ${DASH} \\d{4}-\\d{2}-\\d{2}$`, 'm').test(text)) {
        fail('package.json version needs a dated CHANGELOG heading.');
    }
}

// Dependencies are injectable so failure paths never need a real release or network.
export function requirePrepSetup(query = sh, stat = statSync) {
    const list = resolve(query('git rev-parse --git-common-dir'), 'info', 'private-names');
    let ready = false;
    try { const info = stat(list); ready = info.isFile() && info.size > 0; } catch { /* missing */ }
    if (!ready) fail('create a nonempty .git/info/private-names in the common git directory before release:prep.');
    let hooks = '';
    try { hooks = query('git config core.hooksPath'); } catch { /* unset */ }
    if (hooks !== 'scripts/hooks') fail('run `npm run hooks:install` (core.hooksPath must be scripts/hooks).');
}

export function requirePublishState(query = sh, read = readLf) {
    if (query('git rev-parse --abbrev-ref HEAD') !== 'main') fail('publish requires main.');
    if (query('git status --porcelain')) fail('publish requires a clean working tree.');
    try { query('git fetch -q origin'); } catch { fail('git fetch origin failed; check network and remote access before publishing.'); }
    if (query('git rev-parse HEAD') !== query('git rev-parse origin/main')) fail('HEAD must equal origin/main before publishing.');
    const { version } = JSON.parse(read('package.json'));
    if (query('git log -1 --format=%s') !== `chore(release): ${version}` && query('git log -1 --format=%H -- package.json') !== query('git rev-parse HEAD')) fail(`publish requires the release commit for ${version} at HEAD, or package.json last changed at HEAD.`);
    requireDatedHeading(read('CHANGELOG.md'), version);
    let versions;
    try {
        versions = JSON.parse(query(`npm view ${PACKAGE} versions --json`));
        if (!Array.isArray(versions) || !versions.every((v) => typeof v === 'string')) throw new Error('invalid npm response');
    } catch { fail('npm version lookup failed; check network and registry access before publishing.'); }
    if (versions.includes(version)) fail(`${version} is already on npm; prepare a new release before publishing.`);
}

export function checkPublish(query = sh, read = readLf, execute = run) {
    requirePublishState(query, read);
    for (const command of ['npm run build', 'npm run build:types']) {
        try { execute(command); } catch { fail(`${command} failed; publish stopped. Fix the build and retry.`); }
    }
    console.log('release: publish checks passed; dist/ and types rebuilt.');
}

export function prepareRelease(version, changelog, { execute = run, query = sh, write = writeFileSync, pack = packInfo } = {}) {
    // Ordinary failures happen before any version or documentation change.
    try { execute('npm ci'); } catch { fail('pre-bump npm ci failed; version unchanged. Fix package.json/package-lock.json and retry.'); }
    try { execute('npm run ci'); } catch { fail('pre-bump npm run ci failed; version unchanged. Fix CI and retry.'); }
    if (query('git status --porcelain')) fail('pre-bump CI changed tracked files; review them before retrying.');
    const original = query('git rev-parse HEAD');
    let step = 'npm version';
    let committed = false;
    try {
        execute(`npm version ${version} --no-git-tag-version --package-lock=true`);
        step = 'date CHANGELOG';
        write(resolve('CHANGELOG.md'), changelog);
        step = 'npm run gen'; execute(step);
        step = 'post-bump npm run ci'; execute('npm run ci');
        step = 'npm pack'; const result = pack();
        step = 'git add'; execute('git add -A');
        step = 'git commit'; execute(`git commit -q -m "chore(release): ${version}"`);
        committed = true;
        step = 'git push'; execute('git push -q origin main');
        return result;
    } catch {
        // A hook can create a commit then fail. Check HEAD as well as our flag.
        let status = '(git status unavailable)';
        try { committed = committed || query('git rev-parse HEAD') !== original; } catch { /* retain known state */ }
        try { status = query('git status --short') || '(none)'; } catch { /* retain fallback */ }
        fail(`${step} failed. Commit already made: ${committed ? 'yes' : 'no'}.\nChanged files (git status --short):\n${status}\nUndo local release changes: git reset --hard ${original}\nRebuild ignored output after undo: npm run gen && npm run build && npm run build:types\nNothing undone automatically. If push failed, check origin before retrying; it may have received the commit.`);
    }
}

function packInfo() {
    const [pack] = JSON.parse(sh('npm pack --dry-run --json --ignore-scripts'));
    return { shasum: pack.shasum, files: pack.entryCount };
}

export function requireShasumForTag(tag, cleanReleaseHead) {
    if (tag && !cleanReleaseHead) fail('Cannot tag: shasum not compared; check out the clean release commit and retry.');
}

/** @param {boolean} dryRun */
export function prep(dryRun, { query = sh, read = readLf, setup = requirePrepSetup, prepare = prepareRelease } = {}) {
    setup();
    if (query('git rev-parse --abbrev-ref HEAD') !== 'main') fail('not on main.');
    if (query('git status --porcelain')) fail('the working tree has changes; commit or stash them first.');
    query('git fetch -q origin');
    if (query('git rev-parse HEAD') !== query('git rev-parse origin/main')) fail('main and origin/main differ; pull or push first.');

    const current = JSON.parse(read('package.json')).version;
    const published = query(`npm view ${PACKAGE} version`);
    if (current !== published) fail(`package.json has ${current} but npm has ${published}; is a release already prepared and not yet published?`);

    const version = nextPatch(published);
    const date = localDate();
    let changelog;
    try { changelog = dateChangelog(read('CHANGELOG.md'), version, date); } catch (e) { fail(/** @type {Error} */ (e).message); }

    console.log(`release: ${published} -> ${version}, dated ${date}`);
    if (dryRun) {
        console.log('release: dry run; nothing changed, CI not run. Steps: npm ci, npm run ci, npm version (including lockfile), CHANGELOG heading, npm run gen, npm run ci, commit, push.');
        return;
    }

    const pack = prepare(version, changelog);

    console.log(`\nrelease: ${version} prepared and pushed as ${query('git rev-parse --short HEAD')}`);
    console.log(`release: local pack ${pack.shasum}, ${pack.files} files`);
    console.log('release: next, the maintainer runs `npm publish --access public`, then `npm run release:verify`.');
}

/**
 * Creates the GitHub release for a pushed tag, with that release's CHANGELOG section as notes.
 * @param {string} tagName @param {string} commit @param {string} version
 */
function githubRelease(tagName, commit, version) {
    try { sh('gh --version'); } catch { fail('--github-release needs the GitHub CLI (`gh`), signed in.'); }
    try {
        sh(`gh release view ${tagName} --json tagName`);
        return `GitHub release ${tagName} already exists`;
    } catch { /* not released yet */ }
    const notesFile = resolve(sh('git rev-parse --git-common-dir'), `release-notes-${version}.md`);
    writeFileSync(notesFile, changelogSection(sh(`git show ${commit}:CHANGELOG.md`).replace(/\r\n/g, '\n'), version));
    try {
        run(`gh release create ${tagName} --verify-tag --title ${tagName} --notes-file "${notesFile}"`);
    } finally {
        rmSync(notesFile, { force: true });
    }
    return `created GitHub release ${tagName} from the CHANGELOG`;
}

/** @param {string | undefined} versionArg @param {boolean} tag @param {boolean} ghRelease */
async function verify(versionArg, tag, ghRelease) {
    const version = versionArg || JSON.parse(readLf('package.json')).version;
    nextPatch(version);
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
    if (!validGitHead(commit)) fail('npm gitHead must be exactly 40 hexadecimal characters; release verification stopped.');
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
        requireShasumForTag(tag, false);
        report.push('shasum not compared: HEAD is not the clean release commit');
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
        if (ghRelease) report.push(githubRelease(tagName, commit, version));
    }
    if (ghRelease && !tag) report.push('no GitHub release: it needs the tag (drop --no-tag)');

    console.log(report.map((line) => `release: ${line}`).join('\n'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [command, ...rest] = process.argv.slice(2);
    try {
        if (command === 'prep') prep(rest.includes('--dry-run'));
        else if (command === 'check-publish') checkPublish();
        else if (command === 'verify') await verify(rest.find((a) => !a.startsWith('--')), !rest.includes('--no-tag'), rest.includes('--github-release'));
        else fail('usage: node scripts/release.js prep [--dry-run] | check-publish | verify [X.Y.Z] [--no-tag] [--github-release]');
    } catch (error) {
        const message = error.status !== undefined ? 'git/npm command failed; check network, credentials and repository access, then retry.' : error.message;
        console.error(`release: ${message}`);
        process.exitCode = 1;
    }
}
