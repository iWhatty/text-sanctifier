// tests/types/consumer.ts
// Compiled (never run) by `npm run test:types` against dist/types through the
// package's own `exports` map, so a broken type re-export fails CI.

import {
  inspectText,
  inspectTextDetailed,
  getNewlineStats,
  getRecommendedSanctifierOptions,
  summonSanctifier,
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
} from 'text-sanctifier';
import type {
  DetailedTrashReport as BrowserDetailedTrashReport,
  TrashFinding as BrowserTrashFinding,
  TrashCounts as BrowserTrashCounts,
  TrashCategory as BrowserTrashCategory,
  InspectDetailedOptions as BrowserInspectDetailedOptions,
} from 'text-sanctifier/browser';

const options: InspectDetailedOptions = { maxFindings: 10 };
const report: DetailedTrashReport = inspectTextDetailed('a​b', options);
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

const newlines: NewlineStats = getNewlineStats('a' + '\r\n' + 'b');
const newlineTypes: ('CRLF' | 'CR' | 'LF')[] = newlines.types;
const mixed: boolean = newlines.mixed;

// @ts-expect-error not a TrashCategory
const bad: TrashCategory = 'not_a_category';

export { total, category, browserOptions, browserCategory, browserCounts, clean, newlineTypes, mixed, bad };
