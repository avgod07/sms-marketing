#!/bin/bash
set -e

# If running inside the dev container, /.dockerenv will exist.
if [ -f "/.dockerenv" ]; then
  echo "Resetting database inside dev container..."
  
  echo "Dropping all tables and recreating schema..."
  # Use Drizzle to drop and recreate the schema
  npm run db:push -- --force
  
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
  
  echo "Database reset, migrated, and seeded successfully!"
else
  echo "This script should be run inside the VS Code dev container." >&2
  echo "Open the folder in a dev container and re-run ./scripts/reset-db.sh" >&2
  exit 1
fi
