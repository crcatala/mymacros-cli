# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Update the CLI in place** — `mymacros update` (no argument) updates the tool the
  way it was installed: it pulls, reinstalls, and rebuilds a source checkout, and reinstalls the
  registry release for global npm, pnpm, bun, or mise installs. `update --check` reports only
  (exit 0 up to date, 1 update available, 2 unknown) and `update --force` updates even when
  already current. `mymacros update <id> --serving N` still updates a logged food entry.
- **`mymacros version`** — prints version, full commit, commit date, source-checkout status, and
  install path; `--json` returns the same details as an object.

### Changed

- `--version` now prints `mymacros X.Y.Z (sha7 YYYY-MM-DD)` (`-dirty` for an uncommitted build),
  so a local build and an npm install report the commit they came from.

## [0.4.1] - 2026-09-11

### Fixed

- Restored authentication by switching to the migrated `login2.php` endpoint.

## [0.4.0] - 2026-08-15

### Added

- Added commands to create and delete custom foods.

### Changed

- Improved custom food browsing and creation workflows.

### Fixed

- Corrected fast-track custom food request payload fields.
- Improved tolerance for malformed API log fields.

## [0.3.0] - 2026-08-02

### Added

- **Auth status shows username** — `mymacros auth status` now displays "Logged in as
  `<username>`" when credentials are configured, matching the welcome message shown
  on `auth login`. Previously it only described the credential location and freshness.

### Changed

- **README expanded** — Added npm version and license badges, a Features overview,
  Quick Start tutorial, and an `npx` one-liner for running without installing. Added
  a "Web access and account eligibility" section documenting that food-log writes
  may fail for mobile-only (non-Pro/Macro Coach) accounts.

## [0.2.0] - 2026-08-01

### Added
- Initial public release.
