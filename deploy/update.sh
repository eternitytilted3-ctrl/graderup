#!/usr/bin/env bash
# GraderUP — update a running VPS install to the latest commit: bash deploy/update.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker image prune -f >/dev/null
echo "Обновлено. Логи: docker compose -f docker-compose.prod.yml logs -f app"
