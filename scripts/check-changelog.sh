#!/usr/bin/env bash
# Fail a release when CHANGELOG.md has no unreleased user-facing entries.
set -euo pipefail

content=$(awk '/^## \[Unreleased\]/{found=1; next} /^## \[/{exit} found{print}' CHANGELOG.md)
if ! grep -q '^### ' <<<"$content"; then
  echo 'Error: CHANGELOG.md has no entries in its [Unreleased] section.' >&2
  echo 'Add a Keep a Changelog section such as "### Added" before releasing.' >&2
  exit 1
fi

echo 'Changelog has unreleased entries.'
