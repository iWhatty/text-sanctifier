// scripts/browser-build.js
//
// How dist/text-sanctifier.min.js is built, shared by scripts/build.js (which writes it)
// and scripts/gen-docs.js (which writes its size into the docs).

import { build } from 'esbuild';
import { gzipSync } from 'zlib';
import { resolve } from 'path';

// The prebuilt file's public size promise (README: "under 4 KiB"). It is for pages that
// load the file without a bundler; bundler users pay only for what they import.
export const GZIP_BUDGET_BYTES = 4096;

/** Builds the browser file in memory: the minified code and its gzipped bytes. */
export async function buildBrowserFile() {
    const result = await build({
        entryPoints: [resolve('src/index.js')],
        bundle: true,
        minify: true,
        format: 'esm',
        target: ['es2020'],
        charset: 'ascii', // keep \u escapes; never emit raw invisible characters
        legalComments: 'none',
        write: false,
    });
    const code = result.outputFiles[0].contents;
    return { code, gzipped: gzipSync(code, { level: 9 }) };
}
