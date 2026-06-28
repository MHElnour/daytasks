# DayTasks - Unreleased

<!--
Use this file for user-facing changes only.

Sections:
- Added
- Changed
- Fixed
- Removed
- Security

DayTasks is English-only right now; no i18n release workflow is required.
-->

## Security

- **Release assets now carry build-provenance attestations.** You can
  cryptographically verify that `main.js`, `manifest.json`, and `styles.css` were
  built from this repository's source.

## Internal

- Releases are now built, attested, and published by GitHub Actions.
- Added GitHub issue templates (bug report / feature request) and a Discussions
  space for questions and ideas.
- Replaced an internal property-drop pattern with a small `omit()` helper
  (no behavior change).
