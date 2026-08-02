#!/usr/bin/env bash
# Usage: npm run release:prep [last-tag]
# Prints commit context and a prompt for drafting the next changelog section.
set -euo pipefail

last_tag="${1:-$(git describe --tags --abbrev=0 2>/dev/null || true)}"
if [[ -n "$last_tag" ]] && ! git rev-parse --verify --quiet "${last_tag}^{commit}" >/dev/null; then
  echo "Error: '$last_tag' is not a valid tag or commit." >&2
  exit 1
fi

range='HEAD'
[[ -n "$last_tag" ]] && range="${last_tag}..HEAD"

echo '=== Release Prep ==='
[[ -n "$last_tag" ]] && echo "Changes since: $last_tag" || echo 'No prior tag; showing all commits.'
echo
echo '=== Commits ==='
git log "$range" --pretty=format:'- %s (%h)' --no-merges
echo -e '\n\n=== Changed files ==='
if [[ -n "$last_tag" ]]; then
  git diff --stat "$range"
else
  git diff --stat "$(git hash-object -t tree /dev/null)" HEAD
fi
echo -e '\n\n=== Changelog prompt ==='
cat <<'EOF'
Draft Keep a Changelog entries from these commits. Include only user-facing changes.
Group items under Added, Changed, Fixed, Removed, or Security; omit empty groups.
Exclude internal tests, CI, and routine dependency updates unless users are affected.
EOF
