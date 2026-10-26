#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -ne 2 ]]; then
  echo "Использование: bash scripts/restore-teksher-hub.sh <database.dump> <uploads.tar.gz>" >&2
  exit 2
fi

DB_BACKUP="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
UPLOADS_BACKUP="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
DB_SERVICE="${DB_SERVICE:-db}"
API_SERVICE="${API_SERVICE:-api}"
DB_NAME="${DB_NAME:-}"
DB_USERNAME="${DB_USERNAME:-}"

[[ -s "$DB_BACKUP" ]] || { echo "Ошибка: дамп базы не найден или пуст: $DB_BACKUP" >&2; exit 1; }
[[ -s "$UPLOADS_BACKUP" ]] || { echo "Ошибка: архив вложений не найден или пуст: $UPLOADS_BACKUP" >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "Ошибка: Docker не найден." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Ошибка: Docker Compose недоступен." >&2; exit 1; }
docker compose ps --status running --services | grep -Fxq "$DB_SERVICE" || {
  echo "Ошибка: сервис базы данных '$DB_SERVICE' не запущен." >&2
  exit 1
}
if [[ -z "$DB_USERNAME" ]]; then
  DB_USERNAME="$(docker compose exec -T "$DB_SERVICE" sh -c 'printf "%s" "${POSTGRES_USER:-teksher}"' | tr -d '\r')"
fi
if [[ -z "$DB_NAME" ]]; then
  DB_NAME="$(docker compose exec -T "$DB_SERVICE" sh -c 'printf "%s" "${POSTGRES_DB:-teksher_hub}"' | tr -d '\r')"
fi


echo "Проверяю структуру резервных копий..."
docker compose exec -T "$DB_SERVICE" pg_restore --list < "$DB_BACKUP" >/dev/null
tar -tzf "$UPLOADS_BACKUP" | grep -Eq '^uploads/?
ВНИМАНИЕ: восстановление заменит данные в PostgreSQL из указанного дампа
и удалит текущие файлы из каталога вложений перед распаковкой архива.
Сначала убедись, что выбраны правильные файлы и сервисы.
WARNING
read -r -p "Для продолжения введи RESTORE: " confirmation
[[ "$confirmation" == "RESTORE" ]] || { echo "Восстановление отменено."; exit 1; }

api_stopped=0
restart_api() {
  if [[ "$api_stopped" -eq 1 ]]; then
    docker compose start "$API_SERVICE" >/dev/null || true
  fi
}
trap restart_api EXIT

echo "Останавливаю API, чтобы избежать записи во время восстановления..."
docker compose stop "$API_SERVICE"
api_stopped=1

echo "Восстанавливаю PostgreSQL..."
docker compose exec -T "$DB_SERVICE" pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error \
  -U "$DB_USERNAME" -d "$DB_NAME" < "$DB_BACKUP"

echo "Заменяю архив вложений..."
docker compose run -T --rm --no-deps --entrypoint sh "$API_SERVICE" -c \
  'set -eu; mkdir -p /app/uploads; find /app/uploads -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -xzf - -C /app' \
  < "$UPLOADS_BACKUP"

docker compose start "$API_SERVICE"
api_stopped=0
trap - EXIT

echo "Восстановление завершено. Проверь /api/health, вход и открытие нескольких документов с вложениями."
 || {
  echo "Ошибка: архив не содержит ожидаемый каталог uploads/." >&2
  exit 1
}

cat <<'WARNING'
ВНИМАНИЕ: восстановление заменит данные в PostgreSQL из указанного дампа
и удалит текущие файлы из каталога вложений перед распаковкой архива.
Сначала убедись, что выбраны правильные файлы и сервисы.
WARNING
read -r -p "Для продолжения введи RESTORE: " confirmation
[[ "$confirmation" == "RESTORE" ]] || { echo "Восстановление отменено."; exit 1; }

api_stopped=0
restart_api() {
  if [[ "$api_stopped" -eq 1 ]]; then
    docker compose start "$API_SERVICE" >/dev/null || true
  fi
}
trap restart_api EXIT

echo "Останавливаю API, чтобы избежать записи во время восстановления..."
docker compose stop "$API_SERVICE"
api_stopped=1

echo "Восстанавливаю PostgreSQL..."
docker compose exec -T "$DB_SERVICE" pg_restore --clean --if-exists --no-owner --no-acl --exit-on-error \
  -U "$DB_USERNAME" -d "$DB_NAME" < "$DB_BACKUP"

echo "Заменяю архив вложений..."
docker compose run -T --rm --no-deps --entrypoint sh "$API_SERVICE" -c \
  'set -eu; mkdir -p /app/uploads; find /app/uploads -mindepth 1 -maxdepth 1 -exec rm -rf -- {} +; tar -xzf - -C /app' \
  < "$UPLOADS_BACKUP"

docker compose start "$API_SERVICE"
api_stopped=0
trap - EXIT

echo "Восстановление завершено. Проверь /api/health, вход и открытие нескольких документов с вложениями."
