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

## Changed

- **Task titles and descriptions now show as clean text.** Markdown you type —
  `**bold**`, `[[wikilinks]]`, `` `code` ``, `~~strike~~`, links — is flattened to
  readable text in the widget and task list instead of showing the raw `**`/`[[`
  symbols. The syntax no longer counts toward the title/description character
  limit and is stripped when a task is saved. Your note files are left untouched.
