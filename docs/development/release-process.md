# Release Process

DayTasks releases are bumped + tagged locally, then built, attested, and
published by GitHub Actions. Build artifacts are release assets, not committed
source files.

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
- confirm `manifest.json` has the correct `minAppVersion`;
- confirm `versions.json` maps the new version to that minimum app version;
- confirm release notes contain only user-facing changes.

## Publish

After review:

```bash
npm run release:publish
```

This pushes the branch and the version tag. Pushing the tag triggers the
`Release` workflow (`.github/workflows/release.yml`), which checks out the tag,
runs `npm run check` + `npm run build`, attests build provenance for the assets,
and creates the GitHub Release with `main.js`, `manifest.json`, and `styles.css`
attached. Watch the run under the repository's **Actions** tab.

## Release Assets And Provenance

`main.js` and `styles.css` are gitignored build artifacts. The CI runner builds
them from the tagged source and ships them as GitHub Release assets with
`manifest.json` — never as committed files. Each release asset carries a
[build-provenance attestation](https://docs.github.com/actions/security-guides/using-artifact-attestations-to-establish-provenance-for-builds),
so users can cryptographically verify the assets were built from this repo.

## When To Update Release Notes

Update `docs/releases/unreleased.md` only for user-facing behavior changes.
Do not add entries for tests, internal refactors, or documentation-only cleanup.
