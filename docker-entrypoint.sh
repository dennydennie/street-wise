#!/bin/sh
# Runs before the API on every deploy: apply migrations, upsert the camera list,
# optionally refresh the demo history (SEED_DEMO=true; refused in production).
set -e

echo "[entrypoint] running migrations"
node node_modules/typeorm/cli.js migration:run -d dist/data-source.js

echo "[entrypoint] seeding cameras"
node dist/database/seeds/seed-cameras.js

if [ "$SEED_DEMO" = "true" ]; then
  echo "[entrypoint] seeding demo history"
  node dist/database/seeds/seed-demo.js
fi

exec "$@"
