# Working on text-sanctifier

Read [DESIGN.md](DESIGN.md) first. It covers the two audiences (web and agents), the invariants, why category names are API, and the release rules.

Quick rules:

- Run `npm run ci` before committing. It must exit 0. It runs locally; don't add GitHub Actions or other cloud CI. New checks go in that script.
- Releases bump only the patch number, and work done close together goes out as one release. A maintainer publishes, because npm needs two-factor credentials. Tag `vX.Y.Z` after the release appears on npm.
- A new export needs types, a dist-test assertion, and a size probe with a budget in `scripts/check-size.js`. Detection-only probes must not pull in the sanitizer (leak checks).
- CHANGELOG entries say what changed for someone using the package, a line or two each, with behavior changes called out. Leave out byte counts, size budgets, tests, build scripts and README tweaks; commit messages carry those.
- Never put raw invisible characters in source or tests. Check script edits by printing the changed lines as escaped ASCII.
- This repo is public: don't name private downstream projects in code, docs, commit messages or the CHANGELOG.
