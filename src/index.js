// src/index.js


import { inspectText, inspectTextDetailed, getNewlineStats, getRecommendedSanctifierOptions } from './inspectText.js';
export { inspectText, inspectTextDetailed, getNewlineStats, getRecommendedSanctifierOptions };

import { summonSanctifier } from './sanctifyText.js';
export { summonSanctifier };

// Type-only re-exports so TypeScript consumers can name these from the package root.
/** @typedef {import('./inspectText.js').UnicodeTrashReport} UnicodeTrashReport */
/** @typedef {import('./inspectText.js').TrashCategory} TrashCategory */
/** @typedef {import('./inspectText.js').TrashFinding} TrashFinding */
/** @typedef {import('./inspectText.js').TrashCounts} TrashCounts */
/** @typedef {import('./inspectText.js').DetailedTrashReport} DetailedTrashReport */
/** @typedef {import('./inspectText.js').InspectDetailedOptions} InspectDetailedOptions */
/** @typedef {import('./inspectText.js').NewlineStats} NewlineStats */
/** @typedef {import('./sanctifyText.js').SanctifyOptions} SanctifyOptions */


// In Future: export helpers for power users
// export { purgeInvisibleTrash, purgeEmojisCharacters, normalizeNewlines, trimSpacesAroundNewlines, collapseParagraphs, collapseExtraSpaces, purgeControlCharacters } from './sanctifyText.js';
