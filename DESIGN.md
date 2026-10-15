# Design notes: `text-sanctifier`

Why this library exists, who it serves, and the rules that keep it trustworthy. Read this before adding a feature, a category or a build target.

## What it is

Text is the shared material of language, code, configuration and model prompts. Invisible and control characters slip into it all the time: a script emits the wrong code point, a paste carries a non-breaking space, a bidi control reorders what a reviewer sees, tag characters hide instructions that a person can't see but a language model reads. Usually it isn't an attack, just a stray character that shouldn't be committed. Sometimes it is an attack.

`text-sanctifier` does two jobs:

1. **Inspect**: find these characters and report exactly where they are.
2. **Sanctify**: remove or normalize them, with presets and fine-grained flags.

It is not an HTML/XSS sanitizer and not a full security scanner. For those jobs, use or combine dedicated tools.

## Two audiences

The same source serves two kinds of consumer, with different constraints.

| | **Web** (websites, browser extensions) | **Node and agents** (coding agents, CI, developer tooling) |
| --- | --- | --- |
| Main job | Clean user input; security hygiene | Stop invisible "slop" being committed; give agents exact locations they can't see for themselves |
| Entry point | `text-sanctifier/browser` (minified ESM bundle) | `text-sanctifier` (ESM source) and the `text-sanctifier` command |
| Constraint | Bundle size: every byte ships to every user | Capability: structured output, clear errors, predictable behavior |
| Budget | Keep the gzipped bundle small, no dependencies | Size matters less than correctness and clarity |

When the two pull apart, split the entry points rather than compromise both. Node-only features (file walking, the command-line tool, heavier analysis) belong in the Node entry point or the command-line tool, never in the browser bundle. A dedicated Node entry point with a larger feature set is an acceptable future direction. The browser bundle should keep only what a page or an extension needs.

Code-aware judgement belongs downstream, not here. Whether a zero-width space sits in an identifier, a string literal or a comment needs a syntax tree. This library reports characters and positions; tools that understand the language decide what a finding means.

## Why agents are a first-class audience

Agents (and the people reviewing their work) can't see these characters. A zero-width space or a bidi isolate shows up in tool output as nothing at all. Without a tool, each agent writes its own one-off script, which costs tokens and time and is often subtly wrong. A shared, tested tool:

- lets smaller, faster models do tasks they couldn't script themselves, and
- saves larger models from spending effort on housekeeping that should already be automated.

So the agent-facing surface is held to these rules:

- **Exact and structured.** Offsets, lines, columns, code points, categories. JSON on request. Exit codes that mean something: 0 clean, 1 findings or pending changes, 2 usage or I/O error.
- **Bounded output.** `maxFindings` protects both memory and the reader's context window. Counts stay exact even when the list is capped. `maxFindings: 0` is a counts-only mode.
- **Documented well enough to use without reading the source.** If a consumer has to read `src/` to integrate, the docs are incomplete.
- **Safe defaults.** A model that runs a command with no flags should not lose meaning. A transformation that destroys information, such as splitting emoji sequences, should be opt-in or clearly documented.

## Invariants

These are tested. Keep them true.

- **What inspection reports equals what purging removes.** The categories in `inspectTextDetailed` cover exactly `CONTROL_CHARS_REGEX` ∪ `INVISIBLE_TRASH_REGEX`, checked over every code point U+0000–U+10FFFF.
- **Nothing a renderer hides goes unreported.** Every Default_Ignorable_Code_Point in the running Node's Unicode data is in a category.
- **The browser bundle stays within its size budget** (`GZIP_BUDGET_BYTES` in `scripts/buildc.js`).
- **One pass, no copies** for inspection and newline counting; performance claims in the docs are measured.
- **Zero runtime dependencies.**
- **Public field names survive the minifier.** Closure ADVANCED renames anything not declared in `externs.js`; the dist tests check every public field.
- **Types match the runtime.** A strict TypeScript consumer compiles against `dist/types` through the package `exports` map.

## Categories are API

Consumers switch on category names and read every key of `counts`.

- Adding code points to an existing category is a normal change: note it in the CHANGELOG, because what gets reported and stripped changes.
- Adding a category, or renaming or splitting one, breaks any consumer that handles every category. Plan these deliberately, batch them, and say so prominently in the CHANGELOG.

Known open questions:

- Separating the emoji joiner (U+200D in ZWJ sequences) from standalone zero-width characters.
- Separating benign emoji variation selectors (U+FE00–FE0F) from the supplementary ones (U+E0100–E01EF), which can carry hidden data.
- `nonbreaking_space` also holds U+2000–U+200A, most of which are breaking spaces, so the name misleads.

## Where this sits among similar tools

A survey of overlapping open-source tools in October 2026 found many that detect invisible characters and few that fix them:

- **Detectors** such as anti-trojan-source (npm) and heckler (PyPI) report findings and integrate well (JSON or SARIF output, pre-commit hooks), but they don't remove anything.
- **Linter rules** (ESLint's `no-irregular-whitespace`, eslint-plugin-security, rustc and Clippy lints, Go's bidichk) reach many projects but each covers a narrow set of characters.
- **Fixers** such as out-of-character remove characters but report only an offset.
- **LLM input filters** that stripped hidden text before it reached a model are largely archived, which leaves that job under-served.

This library's place is doing both jobs in one tool: findings with exact positions and typed categories, plus presets that fix, in a small browser build and a command-line tool. Other tools are ahead on integration (SARIF, pre-commit hooks, editor plugins), on metadata per finding (severity, Unicode character names, the decoded text hidden in tag characters), and on context (leaving legitimate emoji and script sequences alone). The roadmap below closes those gaps without giving up the small core.

The problems seen in practice, which this library should keep solving:

- **Model output** that carries narrow non-breaking spaces and other look-alike spaces into code, Markdown and data. The right fix is to replace them with an ordinary space, not delete them.
- **Coding agents** whose edits fail on characters they can't see in their own tool output.
- **Hidden instructions** in rules files, agent skill files, tool descriptions and web content, using tag characters, variation selectors and invisible operators.
- **Everyday data hygiene:** a BOM glued to the first CSV header, U+2028/U+2029 breaking JavaScript and JSON, mixed line endings.

## Roadmap: two tracks, one core

The goal is for the web and server tracks to move forward together without drifting apart. Shared work goes in the core; each track grows only in its own entry point. Status as of October 2026.

### Shared core (both tracks)

- **Done: one table of categories and code-point ranges, used everywhere.** `scripts/categories.js` is the table, and `npm run gen` generates the purge regexes and the classifier (`src/categories.generated.js`), the category list in the `inspectTextDetailed` JSDoc and the README table. `npm run ci` fails while any of them is stale. They are generated rather than built at module load, so the browser bundle ships no table or builder and the classifier stays plain number comparisons.
- **Done: complete coverage of Default_Ignorable_Code_Point**, the Unicode property for characters renderers must draw as nothing. A test checks it against the running Node's Unicode data, so a Node upgrade with newer Unicode fails until the table catches up.
- **Next: one planned set of category changes** for both tracks. It covers the open questions above (the emoji joiner, the two kinds of variation selector, the `nonbreaking_space` name) and characters that are not invisible but still cause trouble: U+2028/U+2029 line and paragraph separators, unpaired surrogates, noncharacters (to be reported or replaced with U+FFFD, never deleted), U+FFFD itself as a sign of a decoding error, and blank-looking characters such as U+1680 and U+2800.
- **A reveal helper** that renders hidden characters visibly (for example `<ZWJ>` or `<U+E0041>`), as Unicode's source-code guidance (UTS #55) recommends, for logs, diffs and agent tool output.
- **One test corpus run against both builds**, so the source build and the browser build can never report differently.

### Server track (Node, agents, CI)

Capability over size.

- **A dedicated server entry point** (for example `text-sanctifier/server`) for features that don't belong in the browser bundle.
- **A check for AI configuration files**: rules files, agent skill files, `CLAUDE.md`/`AGENTS.md` and tool descriptions. It flags runs of tag characters, variation selectors and invisible operators, and decodes what the hidden text says.
- **Integration that runs locally:** SARIF output and a published pre-commit hook manifest. No cloud CI by default.
- **Findings an agent can act on directly:** a severity and the Unicode character name on each finding, and a versioned JSON schema for reports from the library and the command-line tool.
- **Context-aware findings**, using `Intl.Segmenter`, to tell legitimate emoji joiners, colour selectors and flag sequences (and joiners in scripts that need them) from hidden ones, and to leave the legitimate ones alone by default.
- **A bidi balance check** for unterminated or overlapping bidi controls, the specific Trojan Source pattern.
- **`fix` options and reports:** rewrite characters in source as escape sequences instead of deleting them, list each removal by its offset in the original text, and allow suppressions by code point or path.
- **Streaming inspection** for very large files.

### Web track (websites, browser extensions)

Size over features.

- **Done: a gzipped size budget enforced by `npm run ci`.** `GZIP_BUDGET_BYTES` in `scripts/buildc.js` is 3072 bytes; the bundle is 2632. Raising the budget is a deliberate decision made in the same commit as the growth.
- **A preset for model output and pasted text**: look-alike spaces become ordinary spaces, zero-width characters are removed, quote and dash folding is optional, and it reports how many of each it changed.
- **Presets for cleaning form input.**
- **Smaller builds where they pay off** (for example inspect-only), so a page includes only what it uses.

### Not planned here

- **Confusable and homoglyph detection** (UTS #39 skeletons, mixed-script checks) needs large data tables and belongs in a separate layer or tool.
- **Deciding what a finding means in code** (identifier, string or comment) needs a syntax tree and belongs in tools that parse the language.
- **Running checks in cloud CI by default.** Checks run locally.

### Order

1. Done: the single category table, full default-ignorable coverage, and the size budget.
2. The AI configuration file check, SARIF output and the pre-commit hook. These come first because the risk is current and the work is small.
3. The planned category changes, coordinated with consumers and shipped together.
4. Context-aware findings and the reveal helper.
5. The server entry point, once the first server-only feature needs a home.

## Releases

- Bump the patch number only, even for new exports or behavior changes. Batch work done close together into one release. Changing the minor or major number is a deliberate decision. See `PublishChecklist.txt`.
- Describe behavior changes in `CHANGELOG.md` instead of signalling them through the version number.
- Tag releases `vX.Y.Z` on the commit that was published.
- Publishing needs the maintainer's npm two-factor credentials. Agents prepare and verify releases; a maintainer publishes.

## Working in this repo

- `npm run ci` runs the generated-file check, the tests, both builds, the type check and the dist tests. Run it before every commit.
- CI here means the local `npm run ci` script. The repo deliberately has no cloud CI (GitHub Actions or similar), so checks cost nothing to run. Add new checks to the script, not to a workflow.
- To change a category's code points, edit `scripts/categories.js` and run `npm run gen`; never edit `src/categories.generated.js` or the generated README table by hand. The generated classifier is split in two so each half stays small enough for V8 to inline; the generator fails if the table outgrows that.
- A new public field needs an `externs.js` entry, a type, and an assertion in `tests/sanctifyText.test.min.js`.
- Tests build invisible characters with `String.fromCodePoint` and never contain them raw. Take the same care in scripts that edit source: shells and heredocs can turn an escaped `\uXXXX` into the raw character without warning. Check edits by printing lines as escaped ASCII.
- This repository is public. Describe downstream consumers generically. Don't name private projects, link to them, or quote their internals in code, docs, commits or the CHANGELOG.
