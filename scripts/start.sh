#!/bin/sh

set -e

echo "[START] Ensuring data directory exists..."
mkdir -p /app/data
echo "[START] Data directory ready"

echo "[START] Prisma version:"
./node_modules/.bin/prisma --version

echo "[START] Running Prisma migrations..."
./node_modules/.bin/prisma migrate deploy
echo "[START] Migrations complete"

echo "[START] Starting Next.js server..."
exec node server.js
