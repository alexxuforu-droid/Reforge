#!/usr/bin/env bash
# P3-6 — startup budget check (contract: docs/DELIVERY.md §2).
#
# The deferred-startup handoff must complete in the low single-digit seconds.
# This parses the "deferred startup: done in Nms" line out of a startup.log
# and fails on regression.
#
# Usage:
#   bash scripts/check-startup-budget.sh [path-to-startup.log] [budget-ms]
# Defaults: %APPDATA%/com.reforge.app/startup.log, budget 8000ms (8s — a cold
# start with antivirus scanning a fresh exe is slower than the warm run).
#
# Skips (exit 0) when no log exists — CI never produces one (the app doesn't
# run there); the check is for release-testing runs and local launches.
set -uo pipefail
cd "$(dirname "$0")/.."

LOG="${1:-}"
BUDGET="${2:-8000}"

if [ -z "$LOG" ]; then
  if [ -n "$APPDATA" ]; then
    LOG="$APPDATA/com.reforge.app/startup.log"
  else
    LOG="${HOME}/AppData/Roaming/com.reforge.app/startup.log"
  fi
fi

if [ ! -f "$LOG" ]; then
  echo "check-startup-budget: no startup.log at $LOG — skipping (run the release exe once to produce one)"
  exit 0
fi

# Grab the last "deferred startup: done in Nms" line (boots append).
DONE_LINE="$(grep -o 'deferred startup: done in [0-9]*ms' "$LOG" | tail -1)"
if [ -z "$DONE_LINE" ]; then
  echo "check-startup-budget: no 'deferred startup: done in Nms' line in $LOG — cannot check"
  exit 1
fi

MS="$(echo "$DONE_LINE" | grep -o '[0-9]*' )"
echo "check-startup-budget: last deferred startup: ${MS}ms (budget ${BUDGET}ms)"

if [ "$MS" -gt "$BUDGET" ]; then
  echo "check-startup-budget: FAILED — ${MS}ms exceeds the ${BUDGET}ms budget (docs/DELIVERY.md §2)"
  exit 1
fi

echo "check-startup-budget: OK"
