#!/usr/bin/env bash
# Project-specific smoke-test checks for mymacros-cli.
# Sourced by scripts/test-package.sh (the canonical copy) with $consumer set to the
# install prefix of the packed tarball.
set -euo pipefail

# keytar is native; verify its install script supplied the binding. Do not load it here:
# Linux CI deliberately lacks libsecret, and the CLI falls back when no keyring is available.
test -f "$consumer/node_modules/keytar/build/Release/keytar.node"

# The published tarball must keep the CLI entrypoint and the whole build output,
# including the generated build-info stamp.
node -e '
  const pkg = require(process.argv[1]);
  if (!pkg.bin?.mymacros || !pkg.files?.includes("dist")) process.exit(1)
' "$consumer/node_modules/mymacros-cli/package.json"

test -f "$consumer/node_modules/mymacros-cli/dist/build-info.json"
