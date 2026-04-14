#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$ROOT/storage/logs/crawler-$(date +%Y-%m-%d).log"
ERROR_FILE="$ROOT/storage/logs/crawler-errors.log"

if grep -q "Crawl Session Started" "$LOG_FILE" 2>/dev/null; then
    LAST_RUN=$(grep "Crawl Session Started" "$LOG_FILE" | tail -1)
    echo "✓ Crawler active today"
    echo "  $LAST_RUN"
else
    echo "⚠ WARNING: No crawl sessions found today!"
    exit 1
fi

if [[ -f "$ERROR_FILE" ]] && [[ -n "$(find "$ERROR_FILE" -mmin -60 2>/dev/null)" ]]; then
    ERR_LINES=$(wc -l < "$ERROR_FILE" 2>/dev/null || echo 0)
    if [[ "${ERR_LINES:-0}" -gt 0 ]]; then
        echo "⚠ crawler-errors.log has ${ERR_LINES} line(s); file touched in last 60m — review: tail $ERROR_FILE"
    fi
else
    echo "✓ No recent crawler-errors.log activity (or file absent)"
fi

exit 0
