# DayTasks - Unreleased

<!--
Use this file for user-facing changes only.

Sections:
- Added
- Changed
- Fixed
- Removed
- Security

DayTasks is private and English-only right now; no i18n release workflow is
required.
-->

## Added

- **Drag to reorder** — drag a task by its handle to reorder it. Reordering is
  within a group only: top-level tasks reorder among themselves and subtasks
  reorder within their parent. The order is saved and survives a reload.
- **Collapse / expand cards** — a chevron on each card collapses it to a slim
  one-line row (title · id · due) and expands it back. Top-level tasks start
  expanded; subtasks start collapsed.
- **Per-card actions menu** — a ⋮ button on each card opens Edit and Delete.
- **Boxed metadata** — Priority · Due · Created · Estimate now sit in a compact
  four-column box at the top of each card (Created is shown for the first time).
- **Boxed subtasks** — a parent's subtasks live in a titled box with a progress
  bar and a completion percentage.

## Changed

- **Task order is now manual.** Completed tasks no longer sink to the bottom;
  each task keeps the position you drag it to (order falls back to creation time
  until you first reorder a group).
- **Card redesign** — labeled Projects / Contexts / Tags rows, each on a single
  line that scrolls sideways when it overflows; chips are plain text with a
  subtle box on hover; a thin divider separates the description from the property
  rows; Blocked by / Blocking are compact inline rows; tighter, cleaner spacing
  throughout. All styling uses your Obsidian theme colors.

## Fixed

- Clicking a subtask no longer also opens its parent task.
- Contexts are plain labels again (not clickable) and never boxed.

## Removed

- The description "Read more / Read less" toggle — descriptions always show in
  full now.

**Full Changelog**: <https://github.com/MHElnour/daytasks/compare/0.4.3...0.5.0>
