#!/usr/bin/env bash
# Build the npm tarball and smoke-test the CLI exactly as a consumer receives it.
set -euo pipefail

archive=''
tmpdir=$(mktemp -d)
cleanup() {
  [[ -n "$archive" ]] && rm -f "$archive"
  rm -rf "$tmpdir"
}
trap cleanup EXIT

archive=$(npm pack --json | node -e "let input=''; process.stdin.on('data', chunk => input += chunk).on('end', () => console.log(JSON.parse(input)[0].filename))")
tar -xzf "$archive" -C "$tmpdir"
npm install --omit=dev --ignore-scripts --prefix "$tmpdir/package" >/dev/null

node "$tmpdir/package/dist/cli.js" --help >/dev/null
node -e '
  const pkg = require(process.argv[1]);
  if (!pkg.bin?.mymacros || !pkg.files?.includes("dist")) process.exit(1)
' "$tmpdir/package/package.json"

echo 'Package smoke test passed.'
