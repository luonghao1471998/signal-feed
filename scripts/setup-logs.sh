#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT/storage/logs"

mkdir -p "$LOG_DIR"

# Production: chown to web user (uncomment and adjust user/group)
# chown -R www-data:www-data "$LOG_DIR"

chmod -R ug+rwx "$LOG_DIR" 2>/dev/null || chmod -R 775 "$LOG_DIR"

touch "$LOG_DIR/scheduler.log" "$LOG_DIR/crawler.log" "$LOG_DIR/crawler-errors.log" 2>/dev/null || true

# chown www-data:www-data "$LOG_DIR"/*.log 2>/dev/null || true
chmod 664 "$LOG_DIR"/*.log 2>/dev/null || true

echo "✓ Log directories configured"
echo "  Location: $LOG_DIR"
echo "  Files: scheduler*.log, crawler*.log, crawler-errors.log (daily drivers append date)"
