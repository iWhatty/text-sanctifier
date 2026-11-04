// Keep the repository map and local test command complete, including new files.
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

export function checkRepository(files, layout, test) {
    const entries = [];
    const stack = [];
    for (const line of layout.split('\n')) {
        const match = /^([\u2502 ]*)(?:\u251c\u2500\u2500 |\u2514\u2500\u2500 )(\S+)/.exec(line);
        if (!match) continue;
        const depth = match[1].length / 4;
        stack.length = depth;
        const path = [...stack, match[2]].join('');
        entries.push({ path, depth });
        if (match[2].endsWith('/')) stack[depth] = match[2];
    }
    const listed = new Set(entries.map((entry) => entry.path));
    const groups = entries.filter((entry, i) => entry.path.endsWith('/') &&
        (!entries[i + 1] || entries[i + 1].depth <= entry.depth)).map((entry) => entry.path);
    const errors = [];
    for (const file of files) {
        if (!/^(src|scripts|tests)\//.test(file)) continue;
        if (!listed.has(file) && !groups.some((group) => file.startsWith(group))) {
            errors.push(`${file} missing from ProjectLayout.txt`);
        }
        if (/^tests\/[^/]+\.test\.js$/.test(file) && !test.split(/\s+/).includes(file)) {
            errors.push(`${file} missing from package.json test script`);
        }
    }
    return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
            .split('\0').filter((file) => file && existsSync(file));
        const errors = checkRepository(files, readFileSync('ProjectLayout.txt', 'utf8'), JSON.parse(readFileSync('package.json', 'utf8')).scripts.test);
        if (errors.length) throw new Error(errors.join('\n'));
        console.log('check-repo: repository map and test command cover all source, scripts and tests.');
    } catch (error) {
        console.error(`check-repo: ${error.message}`);
        process.exitCode = 1;
    }
}
