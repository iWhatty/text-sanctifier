# CHANGELOG — `text-sanctifier`

> Initial cut seeded from `git log` by the host repo's `tools/seed-changelogs.mjs` script. Version groupings infer release boundaries from tags and commit subjects; rough cuts are expected — review and tighten as part of normal maintenance.

## Unreleased — 2026-03-02

- feat!: add input length guard, improve emoji handling, and generate types  `d76f13a`
- updated pkg size in readme, min + gzip  `198c644`
- chore: normalize README shields row  `7ecc74c`
- chore: rebrand author to WATT3D, interim license  `4300e0b`
- feat: relicense to AGPL-3.0 + WATT3D AI Training Rider  `10a7c99`
- chore: deploy WATT3D AI-bot robots.txt policy  `6df6a09`
- chore: drop DO_NOT_TRAIN_ME, refresh ProjectLayout  `ab319b7`
- chore: revise AI Training Rider (v2 — pre-counsel drafting fixes)  `8f53325`
- chore: rider v3 — remove gameable 0.1% safe harbor  `e018830`
- chore: rider v4 — Commercial Use restricted to Fully Open Source  `771dae3`
- docs(README): apply @whatty README template  `0f12081`
- chore(license): finalize AGPL-3.0 + WATT3D Additional Terms metadata  `e99d436`
- chore: patch version bump to ship license metadata update  `5d7d37b`

## 1.0.17 — 2026-03-02

- cleaned up credit wording and do_not_train file  `623fd71`
- fix(unicode): eliminate global RegExp state bugs and preserve full emoji sequences  `08bb1d0`

## 0.0.16 — 2025-05-28

- Added helper getRecommendedSanctifierOptions.  `7069cf1`
- Enhanced the  EMOJI_REGEX and fallback  `6d8439f`

## 1.0.14 — 2025-05-22

- Added robots.txt  `ae12ad7`
- Bump to version 1.0.11 onNPM.  `09dd7fb`
- Bumped to version 1.0.12 and updated license is now v3.0. Published to NPM  `86c212c`
- Fixed bug where,purgeNonKeyboardChars, would purge newline chars. thus is not desirable since the keyboard can naturally generate newlines via the enter key.  `683d67b`

## 1.0.10 — 2025-05-14

- Added inspectTExt module to simple print a report of the chars found in the text.  `e9d2d88`
- bumped readme to WATT v3.0, and license  `60977da`

## 1.0.8 — 2025-05-08

- Initial Commit, with license, Readme, tests, and npm published  `3441b34`
- package.json updated --> "type": "module"  `f29dfc4`
- Added .strict() and .loose() modes to santifyText to preset default options.  `4f4333d`
- Updated index.d.ta, tohandle the new strict and loose modes.  `c7b1660`
- Imrpoved ReadMe to use the more examples and .strict() and Loose() modes.  `a7ebbcb`
- Added esbuild to test a minfied version.  `530e7b8`
- .ignore files updated to hide build artfacts and temp files.  `56dcf93`
- Added tests for the .min.js code to ensure we bundled and minify'd without breaking anything.  `031a981`
- Added notes to check out Shields.io for badges to finalize the launch.  `ae9aa4a`
- Added Arrow Functions to shorten the sanctifyText functions.  `36afb30`
- Added *.gz to npm ignore.  `4e807bc`
- Bumped to version 1.0.4.  `4610c42`
- testing shields.io in ReadMe  `807049b`
- Updated badges in ReadMe  `0495bb3`
- Added purgeEmojisCharacters, and boolean flag.  `2ba5de0`
- Updated Readme to reflect the purge emoji mode.  `98438e0`
- purgeInvisibleTrash comment improved to match the function logic. We remove these invisible chars, we no longer replace them with a space.  `6616eb0`
- Updated license  `5f6139e`
- feat: add keyboard-only sanitization modes + emoji-safe filtering  `9247412`
- Upadted shield badge targets  `e8ab27d`
- Added Github stars from shields.io  `d8616e5`
