// src/index.js


import { summonSanctifier } from './sanctifyText.js';
export { summonSanctifier };

// // Attach to globalThis for Closure Compiler to keep
// if (typeof globalThis !== 'undefined') {
//     globalThis.summonSanctifier = summonSanctifier;
// }


// Optionally export helpers if you want (power user mode)
// export { purgeInvisibleTrash, normalizeNewlines, trimSpacesAroundNewlines, collapseParagraphs, collapseExtraSpaces, purgeControlCharacters } from './sanctifyText.js';
