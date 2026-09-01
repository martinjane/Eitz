#!/bin/sh
export NODE_ENV=development
export ADMIN_USERNAME="${ADMIN_USERNAME:-dev_user}"

# Load .env.local into environment
if [ -f .env.local ]; then
  set -a
  . ./.env.local
  set +a
fi

PORT=8081 pnpm --filter @workspace/api-server run dev &
PORT=8080 BASE_PATH=/ pnpm --filter @workspace/eitashot run dev &
wait
