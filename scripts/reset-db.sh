#!/bin/bash
set -e

# If running inside the dev container, /.dockerenv will exist.
if [ -f "/.dockerenv" ]; then
  echo "Resetting database inside dev container..."
  npx tsx server/db/reset-schema.ts

  echo "Applying database schema..."
  npm run db:push

  if [ "$1" = "--seed" ]; then
    SEED="y"
  else
    read -p "Seed database with sample data? (y/N) " SEED
  fi

  if [[ "$SEED" =~ ^[Yy]$ ]]; then
    echo "Seeding database..."
    npm run seed
  else
    echo "Skipping seed"
  fi
else
  echo "This script should be run inside the VS Code dev container." >&2
  echo "Open the folder in a dev container and re-run ./scripts/reset-db.sh" >&2
  exit 1
fi
