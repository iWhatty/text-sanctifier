// src/index.d.ts

export interface SanctifyOptions {
  /** Preserve paragraph breaks by collapsing 3+ newlines into 2 */
  preserveParagraphs?: boolean;

  /** Collapse multiple spaces into a single space */
  collapseSpaces?: boolean;

  /** Nuke hidden control characters (excluding whitespace like \n and \t) */
  nukeControls?: boolean;

  /** Remove emoji characters */
  purgeEmojis?: boolean;

  /** Restrict to printable ASCII (+ emoji if `purgeEmojis` is false) */
  keyboardOnlyFilter?: boolean;
}

/** Preconfigured sanitizer function */
export type Sanctifier = (text: string) => string;

/**
 * Summon a reusable text sanitizer.
 */
export function summonSanctifier(
  defaultOptions?: SanctifyOptions,
): Sanctifier;

/**
 * Strict sanitizer preset:
 * - Collapse spaces
 * - Collapse all newlines
 * - Nuke control characters
 * - Purge emojis
 */
export namespace summonSanctifier {
  const strict: Sanctifier;
  const loose: Sanctifier;

  /**
   * Keeps printable ASCII and emoji.
   * Leaves spacing soft and preserves emoji.
   */
  const keyboardOnlyEmoji: Sanctifier;

  /**
   * Keeps printable ASCII only.
   * Collapses whitespace and purges emoji.
   */
  const keyboardOnly: Sanctifier;
}

/**
 * Brutally normalizes and cleans a string of text.
 */
export function sanctifyText(
  text: string,
  preserveParagraphs?: boolean,
  collapseSpaces?: boolean,
  nukeControls?: boolean,
  purgeEmojis?: boolean,
  keyboardOnlyFilter?: boolean
): string;

/** Style of newline characters detected in a string */
export type NewlineStyle = 'LF' | 'CRLF' | 'CR' | 'Mixed' | null;

/**
 * A structural report of anomalies found in text.
 */
export interface UnicodeTrashReport {
  hasControlChars: boolean;
  hasInvisibleChars: boolean;
  hasMixedNewlines: boolean;
  newlineStyle: NewlineStyle;
  hasEmojis: boolean;
  hasNonKeyboardChars: boolean;
  summary: string[];
}

/**
 * Analyze a string and return a report of Unicode/control character issues,
 * invisible characters, newline styles, emojis, and more.
 */
export function inspectText(text: string): UnicodeTrashReport;
