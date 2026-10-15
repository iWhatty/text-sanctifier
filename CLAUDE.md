# Working on text-sanctifier

Read [DESIGN.md](DESIGN.md) first. It covers the two audiences (web and agents), the invariants, why category names are API, and the release rules.

Quick rules:

- Run `npm run ci` before committing. It must exit 0.
- Releases bump only the patch number, and work done close together goes out as one release. A maintainer publishes, because npm needs two-factor credentials. Tag `vX.Y.Z` after the release appears on npm.
- New public fields need `externs.js`, types and a dist-test assertion, or Closure ADVANCED will rename them.
- Never put raw invisible characters in source or tests. Check script edits by printing the changed lines as escaped ASCII.
- This repo is public: don't name private downstream projects in code, docs, commit messages or the CHANGELOG.
