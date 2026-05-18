#!/bin/sh

# Run Prisma migrations
npx prisma migrate deploy

# Start Next.js
node server.js
