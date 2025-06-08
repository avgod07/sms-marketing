#!/bin/bash
set -e

COMPOSE_FILE=".devcontainer/docker-compose.yml"

if ! command -v docker &> /dev/null; then
  echo "Docker is required but not installed." >&2
  exit 1
fi

# Stop and remove containers and volumes
echo "Stopping containers and removing volumes..."
docker compose -f "$COMPOSE_FILE" down -v

# Recreate containers
echo "Starting containers..."
docker compose -f "$COMPOSE_FILE" up -d

# Wait for Postgres to be ready
echo "Waiting for Postgres to accept connections..."
until docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; do
  sleep 1
done

# Apply schema
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

