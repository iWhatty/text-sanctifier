// Shared generation checks, diagnostics and newline-preserving writes.
import { readFileSync, writeFileSync } from 'node:fs';

export const CHECK = process.argv.includes('--check');
export const readLf = file => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
export const hex = cp => cp.toString(16).toUpperCase().padStart(4, '0');

export function generator(name) {
    return {
        fail(message) {
            console.error(`${name}: ${message}`);
            process.exit(2);
        },
        writeOrCompare(file, content) {
            let raw = '';
            try { raw = readFileSync(file, 'utf8'); } catch (error) {
                if (error.code !== 'ENOENT') throw error;
            }
            if (raw.replace(/\r\n/g, '\n') === content) return false;
            if (CHECK) {
                console.error(`${name}: ${file} is out of date; run \`npm run gen\`.`);
                process.exitCode = 1;
            } else {
                writeFileSync(file, raw.includes('\r\n') ? content.replace(/\n/g, '\r\n') : content);
                console.log(`${name}: wrote ${file}`);
            }
            return true;
        },
    };
}
