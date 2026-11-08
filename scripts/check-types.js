// Check actual package resolution, including legacy Node10 (no package self-reference).
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dir = mkdtempSync(join(tmpdir(), 'sanctifier-types-'));
try {
    mkdirSync(join(dir, 'node_modules'));
    symlinkSync(resolve('.'), join(dir, 'node_modules/text-sanctifier'), process.platform === 'win32' ? 'junction' : 'dir');
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
    writeFileSync(join(dir, 'consumer.ts'), readFileSync('tests/types/consumer.ts'));
    const config = JSON.parse(readFileSync('tests/types/tsconfig.json', 'utf8'));
    for (const [moduleResolution, module] of [['NodeNext', 'NodeNext'], ['Node16', 'Node16'], ['Bundler', 'ESNext'], ['Node10', 'ESNext']]) {
        const file = join(dir, 'tsconfig.json');
        writeFileSync(file, JSON.stringify({ ...config, compilerOptions: { ...config.compilerOptions, moduleResolution, module } }));
        const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', file], { stdio: 'inherit' });
        if (result.error) throw result.error;
        if (result.status !== 0) { process.exitCode = 1; break; }
        console.log(`types: ${moduleResolution} passed`);
    }
} finally {
    rmSync(dir, { recursive: true, force: true });
}
