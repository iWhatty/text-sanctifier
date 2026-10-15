// scripts/categories.js
//
// The one table of invisible and control character categories. Everything else is
// generated from it by scripts/gen-categories.js (`npm run gen`):
//   - src/categories.generated.js: CONTROL_CHARS_REGEX, INVISIBLE_TRASH_REGEX and the
//     classifier used by inspectTextDetailed
//   - the category list in the inspectTextDetailed JSDoc (src/inspectText.js)
//   - the category table in README.md
// `npm run ci` fails while any of them is out of date.
//
// Category names are API (see DESIGN.md): consumers switch on them and read every key
// of `counts`. Adding code points to a category is a CHANGELOG entry; adding, renaming
// or splitting a category is a breaking change, and also needs the TrashCategory and
// TrashCounts typedefs, the `counts` initializer in src/inspectText.js, externs.js and
// the dist test.

/**
 * The purge regexes. Each category lists the ones that remove it, so what
 * inspectTextDetailed reports is exactly what the two options strip.
 */
export const PURGE_REGEXES = {
    CONTROL_CHARS_REGEX: { flags: 'g', option: 'nukeControls' },
    INVISIBLE_TRASH_REGEX: { flags: 'gu', option: 'purgeInvisibleChars' },
};

/**
 * In `counts` order. `ranges` are inclusive [first, last] code points, with an
 * optional label for the docs; `note` is appended to the docs in parentheses.
 */
export const CATEGORIES = [
    {
        name: 'bidi_control',
        removedBy: ['CONTROL_CHARS_REGEX', 'INVISIBLE_TRASH_REGEX'],
        ranges: [[0x061C, 0x061C], [0x200E, 0x200F], [0x202A, 0x202E], [0x2066, 0x2069]],
    },
    {
        name: 'zero_width',
        removedBy: ['INVISIBLE_TRASH_REGEX'],
        ranges: [[0x200B, 0x200D], [0x2060, 0x2060]],
    },
    {
        name: 'nonbreaking_space',
        removedBy: ['INVISIBLE_TRASH_REGEX'],
        ranges: [[0x00A0, 0x00A0], [0x2000, 0x200A], [0x202F, 0x202F], [0x205F, 0x205F], [0x3000, 0x3000]],
        note: 'non-breaking and typographic spaces',
    },
    {
        name: 'bom',
        removedBy: ['INVISIBLE_TRASH_REGEX'],
        ranges: [[0xFEFF, 0xFEFF]],
        note: '`atStart` is true at offset 0, where a BOM is legitimate',
    },
    {
        name: 'nul',
        removedBy: ['CONTROL_CHARS_REGEX'],
        ranges: [[0x0000, 0x0000]],
    },
    {
        name: 'c0_control',
        removedBy: ['CONTROL_CHARS_REGEX'],
        ranges: [[0x0001, 0x0008], [0x000B, 0x000C], [0x000E, 0x001F], [0x007F, 0x007F]],
        note: 'tab, LF and CR are whitespace, not trash',
    },
    {
        name: 'c1_control',
        removedBy: ['CONTROL_CHARS_REGEX'],
        ranges: [[0x0080, 0x009F]],
    },
    {
        name: 'invisible_format',
        removedBy: ['INVISIBLE_TRASH_REGEX'],
        ranges: [
            [0x00AD, 0x00AD, 'soft hyphen'],
            [0x034F, 0x034F, 'combining grapheme joiner'],
            [0x180E, 0x180E, 'Mongolian vowel separator'],
            [0x2061, 0x2064, 'invisible operators'],
        ],
    },
    {
        name: 'hangul_filler',
        removedBy: ['INVISIBLE_TRASH_REGEX'],
        ranges: [[0x115F, 0x1160], [0x3164, 0x3164], [0xFFA0, 0xFFA0]],
        note: 'letters that render blank',
    },
    {
        name: 'variation_selector',
        removedBy: ['INVISIBLE_TRASH_REGEX'],
        ranges: [[0xFE00, 0xFE0F, 'VS1-VS16, including VS16 in emoji'], [0xE0100, 0xE01EF, 'VS17-VS256']],
    },
    {
        name: 'tag',
        removedBy: ['INVISIBLE_TRASH_REGEX'],
        ranges: [[0xE0000, 0xE007F]],
        note: 'tag characters, used for "ASCII smuggling" of hidden instructions',
    },
];
