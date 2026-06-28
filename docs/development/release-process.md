# Release Process

DayTasks releases are local and two-step. Build artifacts are release assets,
not committed source files.

## Prepare A Release

Release from `main`.

```bash
npm run release -- patch
# npm run release -- minor
# npm run release -- major
# npm run release -- 0.3.0
```

The release script bumps `manifest.json`, `package.json`, and `versions.json`,
runs the local checks, rolls `docs/releases/unreleased.md` into a versioned
release note, commits `release X.Y.Z`, and creates a bare semver tag such as
`0.8.1`.

Use an explicit semver when needed. Tags do not use a `v` prefix.

## Review Before Publishing

Before publishing:

- inspect the release commit;
- inspect generated `main.js` and `styles.css`;
- confirm `manifest.json` has the correct `minAppVersion`;
- confirm `versions.json` maps the new version to that minimum app version;
- confirm release notes contain only user-facing changes.

## Publish

After review:

```bash
npm run release:publish
```

This pushes the branch and tag and creates the GitHub Release with assets.

## Release Assets

`main.js` and `styles.css` are gitignored build artifacts. They ship as GitHub
Release assets with `manifest.json`, not as committed files.

## When To Update Release Notes

Update `docs/releases/unreleased.md` only for user-facing behavior changes.
Do not add entries for tests, internal refactors, or documentation-only cleanup.
