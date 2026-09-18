#!/usr/bin/env bash
# P4-7 — repo-size guard.
#
# GitHub hard-caps a single file at 100 MB (pushes fail) and soft-limits the
# whole repo at 1 GB. Reforge bundles ffmpeg.exe (~98 MB) next to that cap, so
# this check runs in CI and locally:
#   - FAIL (exit 1) if any tracked file is >= 100 MB — the push would break.
#   - WARN  if the tracked tree is >= 900 MB — plan Git LFS / trimming.
#   - WARN  if any tracked file is >= 95 MB — approaching the cap.
#
# Usage: bash scripts/check-repo-size.sh
set -uo pipefail
cd "$(dirname "$0")/.."

# Only tracked files count (node_modules/.git/target are never pushed).
mapfile -t FILES < <(git ls-files)
if [ ${#FILES[@]} -eq 0 ]; then
  echo "check-repo-size: no tracked files (not a git checkout?) — skipping"
  exit 0
fi

hard_fail=0
total=0
warned=0

for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  size=$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f" 2>/dev/null || echo 0)
  total=$((total + size))
  if [ "$size" -ge 104857600 ]; then
    echo "FAIL: $f is $(numfmt --to=iec "$size" 2>/dev/null || echo "$size bytes") — over GitHub's 100 MB hard cap. Move it to Git LFS or drop it."
    hard_fail=1
  elif [ "$size" -ge 99614720 ]; then
    echo "WARN: $f is $(numfmt --to=iec "$size" 2>/dev/null || echo "$size bytes") — within 5 MB of the 100 MB hard cap."
    warned=1
  fi
done

total_mb=$((total / 1048576))
if [ "$total" -ge 943718400 ]; then
  echo "WARN: tracked tree is ~${total_mb} MB — within 10% of GitHub's 1 GB soft limit. Move media to Git LFS."
  warned=1
fi

echo "check-repo-size: ${#FILES[@]} tracked files, ~${total_mb} MB total"

if [ "$hard_fail" -ne 0 ]; then
  echo "check-repo-size: FAILED (a tracked file exceeds the 100 MB hard cap)"
  exit 1
fi
[ "$warned" -ne 0 ] && echo "check-repo-size: passed with warnings"
echo "check-repo-size: OK"
