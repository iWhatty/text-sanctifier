# Working on text-sanctifier

Read [DESIGN.md](DESIGN.md) first. It covers the two audiences (web and agents), the invariants, why category names are API, and the release rules.

Quick rules:

- Install with `npm ci` from the committed package-lock.json, then run `npm run ci` before committing. It must exit 0. Checks run locally; don't add GitHub Actions or other cloud CI. New checks go in that script.
- Releases bump only the patch number, and work done close together goes out as one release. `npm run release:prep` bumps, dates the CHANGELOG, runs ci, commits and pushes; a maintainer runs `npm publish` (npm needs two-factor credentials); `npm run release:verify` checks npm against the commit and tags `vX.Y.Z`. Don't do these steps by hand.
- Sizes, budgets, counts and the release line in README.md and DESIGN.md, plus the pre-commit `rev:` in README.md, come from `npm run gen` (`<!-- gen:... -->` markers). Don't type current byte counts or versions into docs; add a marker.
- A new export needs types, a dist-test assertion, and a size probe with a budget in `scripts/check-size.js`. Detection-only probes must not pull in the sanitizer (leak checks).
- CHANGELOG entries go under `## Unreleased` until release:prep dates them. They say what changed for someone using the package, a line or two each, with behavior changes called out. Leave out byte counts, size budgets, tests, build scripts and README tweaks; commit messages carry those.
- Never put raw invisible characters in source or tests. Check script edits by printing the changed lines as escaped ASCII.
- This repo is public: don't name private downstream projects in code, docs, commit messages or the CHANGELOG.
  `npm run check:names` (in ci, and the pre-push hook from `npm run hooks:install`) checks against `.git/info/private-names`.
