// scripts/buildc.js
import { build } from 'esbuild';
import { execSync } from 'child_process';
import { gzipSync } from 'zlib';
import { mkdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { resolve } from 'path';

const srcEntry = resolve('src/index.js');
const distDir = resolve('dist');
const bundleFile = resolve(distDir, 'text-sanctifier.bundle.js');
const closureFile = resolve(distDir, 'text-sanctifier.min.js');
const gzippedFile = closureFile + '.gz';
const externsFile = resolve('externs.js');

// Size budget for the browser bundle (web track, see DESIGN.md). Raising it is a
// deliberate decision: change this number in the same commit as the growth, with a reason.
const GZIP_BUDGET_BYTES = 3072;

// Ensure dist folder exists
mkdirSync(distDir, { recursive: true });

(async () => {
    console.log('🔨 Bundling with esbuild...');
    await build({
        entryPoints: [srcEntry],
        bundle: true,
        minify: false,
        format: 'esm',
        target: ['es2022'], // modern: const, let, optional chaining, etc.
        outfile: bundleFile,
        supported: {
            'arrow': true,
            'nullish-coalescing': true
        }
    });


    // Step 1: Read the esbuild output
    let bundleCode = readFileSync(bundleFile, 'utf8');

    // Step 2: Inject globalThis hack ONLY for Closure
    // bundleCode += '\nif (typeof globalThis !== "undefined") { globalThis.summonSanctifier = summonSanctifier, globalThis.inspectText = inspectText; }';

    bundleCode += '\nif (typeof globalThis !== "undefined") { globalThis.summonSanctifier = summonSanctifier, globalThis.inspectText = inspectText, globalThis.getRecommendedSanctifierOptions = getRecommendedSanctifierOptions, globalThis.inspectTextDetailed = inspectTextDetailed, globalThis.getNewlineStats = getNewlineStats; }';


    // Step 3: Write back modified bundle
    writeFileSync(bundleFile, bundleCode);


    console.log('🔒 Running Closure Compiler (ADVANCED)...');
    execSync(`npx google-closure-compiler \
    --js "${bundleFile}" \
    --externs "${externsFile}" \
    --language_in ECMASCRIPT_NEXT \
    --language_out ECMASCRIPT_NEXT \
    --compilation_level ADVANCED \
    --js_output_file "${closureFile}"`, { stdio: 'inherit' });

    console.log('🧹 Replacing globalThis export with ESM export...');
    const closureCode = readFileSync(closureFile, 'utf8');

    // Replace globalThis.summonSanctifier assignment with ESM export

    const fixedCode = closureCode.replace(
        /"undefined"!==typeof globalThis&&\(\s*globalThis\.summonSanctifier=([a-zA-Z_$][0-9a-zA-Z_$]*),\s*globalThis\.inspectText=([a-zA-Z_$][0-9a-zA-Z_$]*),\s*globalThis\.getRecommendedSanctifierOptions=([a-zA-Z_$][0-9a-zA-Z_$]*),\s*globalThis\.inspectTextDetailed=([a-zA-Z_$][0-9a-zA-Z_$]*),\s*globalThis\.getNewlineStats=([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\);/,
        'export { $1 as summonSanctifier, $2 as inspectText, $3 as getRecommendedSanctifierOptions, $4 as inspectTextDetailed, $5 as getNewlineStats };'
    );
    if (fixedCode === closureCode) {
        throw new Error('Closure output did not match the globalThis export pattern; no ESM export was written.');
    }
    // const fixedCode = closureCode.replace(
    //     /"undefined"!==typeof globalThis&&\(\s*globalThis\.summonSanctifier=([a-zA-Z_$][0-9a-zA-Z_$]*),\s*globalThis\.inspectText=([a-zA-Z_$][0-9a-zA-Z_$]*)\s*\);/,
    //     'export { $1 as summonSanctifier, $2 as inspectText };'
    // );


    writeFileSync(closureFile, fixedCode);

    console.log('📦 Gzipping output...');
    const minifiedCode = readFileSync(closureFile);
    const gzipped = gzipSync(minifiedCode);
    writeFileSync(gzippedFile, gzipped);

    const originalBytes = statSync(closureFile).size;
    const gzippedBytes = statSync(gzippedFile).size;

    const originalSizeKB = (originalBytes / 1024).toFixed(2);
    const gzippedSizeKB = (gzippedBytes / 1024).toFixed(2);

    console.log(`✅ Done! Sizes:`);
    console.log(`- Minified: ${originalBytes} bytes (${originalSizeKB} KB)`);
    console.log(`- Gzipped : ${gzippedBytes} bytes (${gzippedSizeKB} KB)`);

    const headroom = GZIP_BUDGET_BYTES - gzippedBytes;
    if (headroom < 0) {
        console.error(`❌ Gzipped bundle is ${-headroom} bytes over the ${GZIP_BUDGET_BYTES}-byte budget (GZIP_BUDGET_BYTES in scripts/buildc.js).`);
        process.exitCode = 1;
    } else {
        console.log(`- Budget  : ${gzippedBytes} / ${GZIP_BUDGET_BYTES} bytes gzipped (${headroom} bytes headroom)`);
    }
})();
