// ./src/reveal.js

import { classifyCodeUnit, classifyAstral } from './categories.generated.js';

/** @typedef {import('./inspectText.js').TrashCategory} TrashCategory */

/**
 * @typedef {Object} RevealOptions
 * @property {(codePoint: number, category: TrashCategory) => string} [format] - Text shown in place of
 *   each hidden character. Default: `<U+XXXX>` (at least four uppercase hex digits).
 */

/**
 * Makes hidden characters visible: every character `inspectTextDetailed` would report is
 * replaced by a marker such as `<U+200B>`, and everything else is kept as it is,
 * including tabs and newlines. Emoji joiners, selectors and flag tags become markers
 * too. Use it to show hidden text in logs, diffs, review tools and agent tool output.
 * A literal `<U+200B>` already in the text looks the same as
 * a marker; pass `format` to choose markers that can't occur in your input.
 *
 * @param {string} text
 * @param {RevealOptions} [options]
 * @returns {string}
 */
export function revealInvisible(text, options = {}) {
    if (typeof text !== 'string') {
        throw new TypeError('revealInvisible expects a string input.');
    }
    const format = options && typeof options.format === 'function'
        ? options.format
        : (codePoint) => '<U+' + codePoint.toString(16).toUpperCase().padStart(4, '0') + '>';

    // Classify directly, without allocating a finding object for every marker.
    let out = '';
    let last = 0;
    for (let i = 0; i < text.length; i++) {
        const codePoint = /** @type {number} */ (text.codePointAt(i));
        const category = codePoint > 0xFFFF ? classifyAstral(codePoint) : classifyCodeUnit(codePoint);
        if (category !== null) {
            out += text.slice(last, i) + format(codePoint, category);
            last = i + (codePoint > 0xFFFF ? 2 : 1);
        }
        if (codePoint > 0xFFFF) i++;
    }
    return out + text.slice(last);
}
