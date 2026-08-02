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
consumer="$tmpdir/consumer"
# Install normally so native dependency install scripts run just as they do for users.
npm install --omit=dev --prefix "$consumer" "$(pwd)/$archive" >/dev/null

"$consumer/node_modules/.bin/mymacros" --help >/dev/null
# keytar is loaded lazily by the CLI; import it directly to verify its native binding.
(
  cd "$consumer"
  node --input-type=module -e "const keytar = (await import('keytar')).default; if (typeof keytar?.getPassword !== 'function') process.exit(1)"
)
node -e '
  const pkg = require(process.argv[1]);
  if (!pkg.bin?.mymacros || !pkg.files?.includes("dist")) process.exit(1)
' "$consumer/node_modules/mymacros-cli/package.json"

echo 'Package smoke test passed.'
