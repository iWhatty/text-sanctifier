// src/index.d.ts

export interface SanctifyOptions {
  /** Preserve paragraph breaks by collapsing 3+ newlines into 2 */
  preserveParagraphs?: boolean;

  /** Collapse multiple spaces into a single space */
  collapseSpaces?: boolean;

  /** Nuke hidden control characters (excluding whitespace like \n and \t) */
  nukeControls?: boolean;

  /** Remove emoji characters. */
  purgeEmojis?: boolean;
}

/** Preconfigured sanitizer function */
export type Sanctifier = (text: string) => string;

/**
 * Summon a reusable text sanitizer.
 * 
 * If `defaultOptions` is provided, it creates a sanitizer configured with human options.
 */
export function summonSanctifier(
  defaultOptions?: SanctifyOptions,
): Sanctifier;

/**
 * Creates a strict sanitizer:
 * - Collapse multiple spaces
 * - Collapse all newlines
 * - Purge control and invisible characters
 * - Purge emoji characters
 */
export function strict(): Sanctifier;

/**
 * Creates a loose sanitizer:
 * - Preserve paragraph breaks
 * - Collapse spaces
 * - Purge invisible characters (but leave control characters)
*  - Preserve emoji characters
 */
export function loose(): Sanctifier;

/**
 * Brutally normalizes and cleans a string of text.
 * 
 */
export function sanctifyText(
  text: string,
  preserveParagraphs: boolean,
  collapseSpaces: boolean,
  nukeControls: boolean,
  purgeEmojis: boolean
): string;
