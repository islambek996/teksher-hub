#!/usr/bin/env bash
set -Eeuo pipefail

: "${PGHOST:=localhost}"
: "${PGPORT:=5432}"
: "${PGUSER:=teksher}"
: "${PGDATABASE:=teksher_hub}"
: "${PGPASSWORD:?PGPASSWORD must be set for the recovery smoke test}"
export PGHOST PGPORT PGUSER PGDATABASE PGPASSWORD

source_db="teksher_restore_smoke_source"
target_db="teksher_restore_smoke_target"
work_dir="$(mktemp -d)"
cleanup() {
  psql -v ON_ERROR_STOP=1 -d "$PGDATABASE" -c "DROP DATABASE IF EXISTS $target_db" >/dev/null 2>&1 || true
  psql -v ON_ERROR_STOP=1 -d "$PGDATABASE" -c "DROP DATABASE IF EXISTS $source_db" >/dev/null 2>&1 || true
  rm -rf "$work_dir"
}
trap cleanup EXIT

psql -v ON_ERROR_STOP=1 -d "$PGDATABASE" -c "DROP DATABASE IF EXISTS $target_db" >/dev/null
psql -v ON_ERROR_STOP=1 -d "$PGDATABASE" -c "DROP DATABASE IF EXISTS $source_db" >/dev/null
psql -v ON_ERROR_STOP=1 -d "$PGDATABASE" -c "CREATE DATABASE $source_db" >/dev/null
psql -v ON_ERROR_STOP=1 -d "$source_db" -c "CREATE TABLE recovery_probe (id INTEGER PRIMARY KEY, marker TEXT NOT NULL); INSERT INTO recovery_probe VALUES (1, 'restored-row-ok')" >/dev/null

echo "Creating PostgreSQL custom-format backup..."
pg_dump --format=custom --no-owner --no-acl --file="$work_dir/database.dump" --dbname="$source_db"
test -s "$work_dir/database.dump"
pg_restore --list "$work_dir/database.dump" >/dev/null

psql -v ON_ERROR_STOP=1 -d "$PGDATABASE" -c "CREATE DATABASE $target_db" >/dev/null
echo "Restoring PostgreSQL backup into a clean database..."
pg_restore --no-owner --no-acl --exit-on-error --dbname="$target_db" "$work_dir/database.dump"
restored_value="$(psql -v ON_ERROR_STOP=1 -At -d "$target_db" -c "SELECT marker FROM recovery_probe WHERE id = 1")"
[[ "$restored_value" == "restored-row-ok" ]] || { echo "Database recovery verification failed." >&2; exit 1; }

echo "Creating and validating uploads archive..."
mkdir -p "$work_dir/source/uploads/nested"
printf '%s\n' "attachment-recovery-ok" > "$work_dir/source/uploads/nested/probe.txt"
tar -C "$work_dir/source" -czf "$work_dir/uploads.tar.gz" uploads
python3 scripts/validate_uploads_archive.py "$work_dir/uploads.tar.gz"
mkdir -p "$work_dir/restored"
tar -xzf "$work_dir/uploads.tar.gz" -C "$work_dir/restored"
cmp "$work_dir/source/uploads/nested/probe.txt" "$work_dir/restored/uploads/nested/probe.txt"

echo "Backup/restore smoke test passed: PostgreSQL row and uploaded file were recovered."
