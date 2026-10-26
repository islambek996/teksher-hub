#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
DB_SERVICE="${DB_SERVICE:-db}"
API_SERVICE="${API_SERVICE:-api}"
DB_NAME="${DB_NAME:-}"
DB_USERNAME="${DB_USERNAME:-}"

command -v docker >/dev/null 2>&1 || { echo "Ошибка: Docker не найден." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Ошибка: Docker Compose недоступен." >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

is_running() {
  docker compose ps --status running --services | grep -Fxq "$1"
}
is_running "$DB_SERVICE" || { echo "Ошибка: сервис '$DB_SERVICE' не запущен." >&2; exit 1; }
is_running "$API_SERVICE" || { echo "Ошибка: сервис '$API_SERVICE' не запущен; архив вложений создать нельзя." >&2; exit 1; }

if [[ -z "$DB_USERNAME" ]]; then
  DB_USERNAME="$(docker compose exec -T "$DB_SERVICE" sh -c 'printf "%s" "${POSTGRES_USER:-teksher}"' | tr -d '\\r')"
fi
if [[ -z "$DB_NAME" ]]; then
  DB_NAME="$(docker compose exec -T "$DB_SERVICE" sh -c 'printf "%s" "${POSTGRES_DB:-teksher_hub}"' | tr -d '\\r')"
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
db_name="teksher-hub-db-$timestamp.dump"
uploads_name="teksher-hub-uploads-$timestamp.tar.gz"
manifest_name="teksher-hub-backup-$timestamp.txt"
db_tmp="$BACKUP_DIR/.$db_name.tmp"
uploads_tmp="$BACKUP_DIR/.$uploads_name.tmp"
manifest_tmp="$BACKUP_DIR/.$manifest_name.tmp"
api_stopped=0
cleanup() {
  rm -f "$db_tmp" "$uploads_tmp" "$manifest_tmp"
  if [[ "$api_stopped" -eq 1 ]]; then
    docker compose start "$API_SERVICE" >/dev/null || true
  fi
}
trap cleanup EXIT

echo "Останавливаю API на время резервного копирования, чтобы согласовать базу и файлы..."
docker compose stop "$API_SERVICE"
api_stopped=1

echo "Создаю резервную копию PostgreSQL..."
docker compose exec -T "$DB_SERVICE" pg_dump -U "$DB_USERNAME" -d "$DB_NAME" -Fc > "$db_tmp"
test -s "$db_tmp" || { echo "Ошибка: дамп PostgreSQL пуст." >&2; exit 1; }

echo "Создаю резервную копию файловых вложений..."
docker compose exec -T "$API_SERVICE" tar -C /app -czf - uploads > "$uploads_tmp"
test -s "$uploads_tmp" || { echo "Ошибка: архив вложений пуст." >&2; exit 1; }

docker compose start "$API_SERVICE"
api_stopped=0

mv "$db_tmp" "$BACKUP_DIR/$db_name"
mv "$uploads_tmp" "$BACKUP_DIR/$uploads_name"
{
  echo "TEKSHER HUB backup"
  echo "Created UTC: $timestamp"
  echo "Database: $db_name"
  echo "Uploads: $uploads_name"
  echo "Database name: $DB_NAME"
  echo "Database service: $DB_SERVICE"
  echo "API service: $API_SERVICE"
  echo "Note: this backup does not contain .env or other secrets."
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$BACKUP_DIR/$db_name" "$BACKUP_DIR/$uploads_name"
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$BACKUP_DIR/$db_name" "$BACKUP_DIR/$uploads_name"
  else
    echo "SHA-256 utility not found; checksums were not generated."
  fi
} > "$manifest_tmp"
mv "$manifest_tmp" "$BACKUP_DIR/$manifest_name"
trap - EXIT

echo "Резервная копия создана:"
printf '  База:      %s\n  Вложения:  %s\n  Манифест:  %s\n' \
  "$BACKUP_DIR/$db_name" "$BACKUP_DIR/$uploads_name" "$BACKUP_DIR/$manifest_name"
echo "Храни копии вне этого компьютера и периодически проверяй восстановление."
