/**
 * @fileoverview Public API externs for text-sanctifier.
 * @externs
 */

/**
 * @param {string} text
 * @param {number=} mode Bitflag mode for sanitizer options
 * @return {string}
 */
var sanctifyText;

/**
 * @param {!SanctifyOptions=} defaultOptions
 * @param {number=} bitFlag Optional precomputed bitflag mode
 * @return {function(string): string}
 */
var summonSanctifier;

/**
 * @return {function(string): string}
 */
summonSanctifier.strict;

/**
 * @return {function(string): string}
 */
summonSanctifier.loose;

/**
 * @typedef {{
 *   preserveParagraphs: (boolean|undefined),
 *   collapseSpaces: (boolean|undefined),
 *   nukeControls: (boolean|undefined),
 * }}
 */
var SanctifyOptions;
