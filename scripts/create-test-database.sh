#!/usr/bin/env bash
# Tạo PostgreSQL database signalfeed_test (một lần) — dùng cùng DB_HOST / DB_USERNAME / DB_PASSWORD như .env
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "Thiếu file .env — copy từ .env.example trước." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source <(grep -E '^DB_(CONNECTION|HOST|PORT|DATABASE|USERNAME|PASSWORD)=' .env | sed 's/\r$//')
set +a

: "${DB_HOST:=127.0.0.1}"
: "${DB_PORT:=5432}"
: "${DB_USERNAME:=postgres}"
export PGPASSWORD="${DB_PASSWORD:-}"
TEST_DB="${DB_DATABASE_TEST:-signalfeed_test}"

if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$TEST_DB'" | grep -q 1; then
  echo "Database '$TEST_DB' đã tồn tại."
  exit 0
fi

psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d postgres -c "CREATE DATABASE \"$TEST_DB\";"
echo "Đã tạo database: $TEST_DB"
echo "Chạy: php artisan test"
