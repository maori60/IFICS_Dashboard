#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."

until npx prisma db push >/dev/null 2>&1
do
  echo "PostgreSQL is unavailable - retrying in 2 seconds..."
  sleep 2
done

echo "Database is ready."

echo "Generating Prisma client..."
npx prisma generate

echo "Seeding database..."
npx prisma db seed

echo "Starting Nuxt..."
npm run start