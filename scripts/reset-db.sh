#!/bin/bash
set -e

# If running inside the dev container, /.dockerenv will exist.
if [ -f "/.dockerenv" ]; then
  echo "Resetting database inside dev container..."
  
  echo "Dropping all tables and recreating schema..."
  
  # Check if DATABASE_URL is set
  if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is not set" >&2
    exit 1
  fi
  
  # Run the Node.js script to drop all tables using tsx to access dependencies
  echo "Dropping all tables..."
  npx tsx scripts/reset-db.js
  
  # Recreate the schema using Drizzle
  echo "Recreating schema..."
  npx drizzle-kit push --config=drizzle.config.ts
  
  if [ "$1" = "--seed" ]; then
    SEED="y"
  else
    read -p "Seed database with sample data? (y/N) " SEED
  fi
  
  if [[ "$SEED" =~ ^[Yy]$ ]]; then
    echo "Seeding database..."
    npm run db:seed
  else
    echo "Skipping seed"
  fi
  
  echo "Database reset, migrated, and seeded successfully!"
else
  echo "This script should be run inside the VS Code dev container." >&2
  echo "Open the folder in a dev container and re-run ./scripts/reset-db.sh" >&2
  exit 1
fi
