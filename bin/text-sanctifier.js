#!/usr/bin/env node
// bin/text-sanctifier.js
//
// Command-line front end for coding agents and CI:
//   text-sanctifier check [paths...]   report invisible and control characters
//   text-sanctifier check --ai-config  report hidden text in agent instruction files
//   text-sanctifier fix [paths...]     remove them in place
//   text-sanctifier reveal [paths...]  print the text with hidden characters shown as <U+XXXX>
//
// Plain Node (>=18), no dependencies. Exit codes: 0 clean, 1 findings (check,
// or fix --dry-run with changes pending), 2 usage or I/O error.

import { main } from './lib/main.js';

for (const stream of [process.stdout, process.stderr]) {
    stream.on('error', (e) => { if (e.code !== 'EPIPE') throw e; });
}

main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code; },
    (e) => {
        process.stderr.write(`text-sanctifier: ${e && e.stack ? e.stack : e}\n`);
        process.exitCode = 2;
    }
);
