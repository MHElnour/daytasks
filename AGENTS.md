# DayTasks - Agent Development Guide

This is an Obsidian plugin. The plugin ID is `daytasks`.

DayTasks is intentionally smaller than TaskNotes. Keep work focused on the
Obsidian daily-note experience before considering API, browser-extension, or
sync features.

## Build & Test

```bash
# TypeScript + unit tests
npm run check

# Production build
npm run build

# Build and copy to the local test vault at ./daytask-vault
npm run build:test
```

To install into a specific vault:

```bash
npm run install-plugin -- /path/to/Vault
```

If the Obsidian desktop CLI is installed and Obsidian is running:

```bash
obsidian vault=daytask-vault plugin:reload id=daytasks
obsidian vault=daytask-vault dev:errors
obsidian vault=daytask-vault eval code="app.plugins.plugins.daytasks ? 'daytasks-loaded' : 'missing'"
```

## Useful Commands

```bash
npm run check         # Typecheck + tests (the pre-commit gate)
npm run test          # Vitest unit tests
npm run test:watch    # Vitest in watch mode
npm run test:coverage # Vitest with v8 coverage
npm run typecheck     # TypeScript only (strict; noUnusedLocals/Parameters)
npm run build-css     # Regenerate styles.css from styles/
npm run build         # Production bundle (typecheck + css + esbuild)
npm run build:test    # Build + install into ./daytask-vault
```

## Testing

Tests run on **Vitest** (not Jest): ESM-native, esbuild-fast, Jest-compatible
API. `vitest.config.ts` sets `environment: happy-dom` globally, so DOM tests need
no per-file annotation. Prefer test-first, and keep logic in pure modules that
can be unit-tested. Obsidian-coupled files (`main.ts`, `settingsTab.ts`,
`taskCreationModal.ts`, `livePreview.ts`, `modals.ts`) can't load in the test
runner, so verify those with `npm run build:test` + the Obsidian CLI rather than
unit tests. See `docs/development/testing.md` for the full workflow.

## Documentation Rules

- Update `docs/index.md` when adding a new documentation area.
- Keep product and user-facing docs as top-level pages under `docs/`.
- Keep development workflow docs under `docs/development/`.
- Do not recreate `docs/design/`, `docs/plans/`, or `docs/private/`.
- When a design or plan is still current, migrate its durable facts into
  `docs/core-concepts.md`, `docs/features.md`, `docs/roadmap.md`, or
  `docs/development/`.
- Delete stale design drafts, implementation plans, and private working notes
  after their useful content is migrated.
- Only create `issue-analysis/` for an active investigation that cannot be
  captured in the current docs. Once resolved, migrate durable lessons into
  `docs/development/` and delete the investigation file before public release.
- New temporary issue-analysis files must include YAML front matter with at
  least: `id`, `status`, `severity`, `opened`, `area`, and `resolution`.

## Issue Status Values

Use these values in YAML front matter and issue-analysis tables:

- `open` - still needs implementation or a decision.
- `in-progress` - actively being worked.
- `resolved` - fixed and verified.
- `partial` - partly fixed; remaining work is listed.
- `deferred` - real issue, parked until a later milestone.
- `wontfix` - intentionally not changing.

## Release Notes

DayTasks is English-only right now. Do not add i18n overhead unless the project
actually becomes multilingual.

When a user-facing behavior changes, add a short note to
`docs/releases/unreleased.md` (no entries for tests — it is user-facing).

## Releasing

Local, two-step (no CI). `main.js`/`styles.css` are gitignored build artifacts
that ship as GitHub Release assets, not commits.

```bash
# 1. Build locally: bump manifest/package/versions.json, run check + build,
#    roll unreleased.md into docs/releases/<version>.md, commit "release X.Y.Z",
#    tag X.Y.Z. Nothing is pushed.
npm run release -- patch        # bug fix:  0.1.0 -> 0.1.1
# npm run release -- minor      # feature:  0.1.0 -> 0.2.0
# npm run release -- major      # big:      0.1.0 -> 1.0.0
# npm run release -- 0.3.0      # explicit (canonical semver only, no leading zeros)

# 2. Review the commit and main.js, then push the branch + tag and create the
#    GitHub Release with assets attached.
npm run release:publish
```

Tags are the bare version number (no `v` prefix, per Obsidian). `versions.json`
maps each version to its `minAppVersion`. Release from `main` (the script warns
otherwise). Bump `minAppVersion` in `manifest.json` before releasing if a new
Obsidian API is required.

## Guardrails

- Do not weaken TypeScript or test settings to make checks pass.
- Do not add API/browser-extension scope until the Obsidian plugin is complete.
- Avoid fake UI controls. If the UI exposes a control, it should work or be
  clearly documented as future work.
- Preserve user data. Treat plugin storage migrations and edit flows as
  high-risk.
