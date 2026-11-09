// tests/types/consumer.ts
// Compiled (never run) by `npm run test:types` against dist/types through the
// package's exports/typesVersions maps, so a broken type re-export fails CI.

import {
  inspectText,
  inspectTextDetailed,
  getNewlineStats,
  getRecommendedSanctifierOptions,
  summonSanctifier,
  sanctifyStrict,
  sanctifyLoose,
  sanctifyKeyboardOnlyEmoji,
  sanctifyKeyboardOnly,
  sanctifyPasted,
  revealInvisible,
  VERSION,
} from 'text-sanctifier';
import type {
  UnicodeTrashReport,
  DetailedTrashReport,
  TrashFinding,
  TrashCounts,
  TrashCategory,
  InspectDetailedOptions,
  NewlineStats,
  SanctifyOptions,
  RevealOptions,
} from 'text-sanctifier';
import type {
  DetailedTrashReport as BrowserDetailedTrashReport,
  TrashFinding as BrowserTrashFinding,
  TrashCounts as BrowserTrashCounts,
  TrashCategory as BrowserTrashCategory,
  InspectDetailedOptions as BrowserInspectDetailedOptions,
} from 'text-sanctifier/browser';
import { findHiddenRuns, decodeTagText, VERSION as HIDDEN_VERSION } from 'text-sanctifier/hidden';
import type { HiddenRun, HiddenRunKind, HiddenRunSequence, HiddenTextScan, HiddenScanOptions, HiddenRunCounts } from 'text-sanctifier/hidden';
import { inspectTextInContext } from 'text-sanctifier/context';
import type { ContextReport, ContextFinding } from 'text-sanctifier/context';
import * as browser from 'text-sanctifier/browser';
import * as root from 'text-sanctifier';

// Both entry points must declare every value export with the same signature.
const browserAPI: typeof root = browser;
const rootAPI: typeof browser = root;
const allOptions: Required<SanctifyOptions> = {
  normalizeSpaces: true, purgeZeroWidthSpaces: true, purgeInvisibleChars: true,
  purgeEmojis: true, nukeControls: true, keyboardOnlyFilter: true,
  normalizeNewlines: true, trimSpacesAroundNewlines: true, collapseNewLines: true,
  preserveParagraphs: true, collapseSpaces: true, finalTrim: true,
  maxLength: 10, onMaxLength: 'truncate',
};
const browserClean: string = browserAPI.summonSanctifier(allOptions)('x');

// Optional fields really are absent on some runtime findings/runs.
const minimalFinding: TrashFinding = { offset: 0, line: 1, column: 1, codePoint: 0x200B, category: 'zero_width' };
const minimalRun: HiddenRun = { kind: 'variation_selector', offset: 0, end: 1, count: 1, line: 1, column: 1 };
// @ts-expect-error BOM position flag is optional
const requiredAtStart: boolean = minimalFinding.atStart;
// @ts-expect-error decoded text is optional for non-tag runs
const requiredDecoded: string = minimalRun.decoded;
// @ts-expect-error unknown sequence value
const badSequence: HiddenRunSequence = 'emoji';
// @ts-expect-error formatter must return a string
const badFormatter: RevealOptions = { format: () => 42 };
// @ts-expect-error context input must be a string
inspectTextInContext(42);
// @ts-expect-error browser sanitizer input must be a string
browser.sanctifyPasted(42);

const scan: HiddenTextScan = findHiddenRuns('x');
// @ts-expect-error non-string input is rejected
findHiddenRuns(42);
// @ts-expect-error non-string input is rejected
decodeTagText(42);
const firstRun: HiddenRun | undefined = scan.runs[0];
const scanOptions: HiddenScanOptions = { maxRuns: 100, maxDecodedLength: 1000 };
const capped: HiddenTextScan = findHiddenRuns('x', scanOptions);
const runCounts: HiddenRunCounts = capped.counts;
const runSummary: string = `${capped.total} ${capped.benignTotal} ${capped.truncated} ${firstRun?.line}:${firstRun?.column} ${firstRun?.decodedTruncated}`;
const versions: string = VERSION + HIDDEN_VERSION;
const pointCounts: HiddenRunCounts = capped.codePointCounts;
const supplementary: number = capped.supplementarySelectorCount;
const inContext: ContextReport = inspectTextInContext('x', { maxFindings: 20 });
const contextFinding: ContextFinding | undefined = inContext.findings[0];
const benignFlag: boolean | undefined = contextFinding?.benign;
const suspiciousZeroWidth: number = inContext.counts.zero_width - inContext.benignCounts.zero_width + inContext.benignTotal;
const benignSupplementary: number = inContext.benignSupplementarySelectorCount;
const runKind: HiddenRunKind | undefined = firstRun?.kind;
const runSequence: HiddenRunSequence | undefined = firstRun?.sequence;
const decodedTags: string = decodeTagText('x');

const options: InspectDetailedOptions = { maxFindings: 10 };
const report: DetailedTrashReport = inspectTextDetailed('a\u200Bb', options);
const finding: TrashFinding | undefined = report.findings[0];
const category: TrashCategory | undefined = finding?.category;
const counts: TrashCounts = report.counts;
const total: number = counts.zero_width + counts.bidi_control;

const browserOptions: BrowserInspectDetailedOptions = options;
const browserReport: BrowserDetailedTrashReport = report;
const browserFinding: BrowserTrashFinding | undefined = browserReport.findings[0];
const browserCategory: BrowserTrashCategory | undefined = browserFinding?.category;
const browserCounts: BrowserTrashCounts = browserReport.counts;

const basic: UnicodeTrashReport = inspectText('x');
const recommended: SanctifyOptions = getRecommendedSanctifierOptions(basic);
const clean: string = summonSanctifier(recommended)('x');
const pastedClean: string = summonSanctifier.pasted('x');
const presetClean: string = sanctifyStrict('x') + sanctifyLoose('x') + sanctifyKeyboardOnlyEmoji('x') + sanctifyKeyboardOnly('x') + sanctifyPasted('x');
const spacing: SanctifyOptions = { normalizeSpaces: true, purgeZeroWidthSpaces: true };
const revealOptions: RevealOptions = { format: (codePoint: number, c: TrashCategory) => `[${c}:${codePoint}]` };
const revealed: string = revealInvisible('x', revealOptions) + revealInvisible('y');

const newlines: NewlineStats = getNewlineStats('a' + '\r\n' + 'b');
const newlineTypes: ('CRLF' | 'CR' | 'LF')[] = newlines.types;
const mixed: boolean = newlines.mixed;

// @ts-expect-error not a TrashCategory
const bad: TrashCategory = 'not_a_category';

export { scan, runKind, decodedTags, total, category, browserOptions, browserCategory, browserCounts, clean, pastedClean, spacing, revealed, newlineTypes, mixed, bad };

// @ts-expect-error invalid maximum-length policy
const badMaxLength: SanctifyOptions = { onMaxLength: 'bogus' };
