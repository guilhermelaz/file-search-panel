#!/bin/sh

set -e

echo "[START] Ensuring data directory exists..."
mkdir -p /app/data
echo "[START] Data directory ready"

echo "[START] Running Prisma migrations..."
npx prisma migrate deploy
echo "[START] Migrations complete"

echo "[START] Starting Next.js server..."
exec node server.js
