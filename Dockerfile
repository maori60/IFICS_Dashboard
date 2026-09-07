FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN chmod +x docker-entrypoint.sh

# Prisma loads prisma.config.ts while generating the client. Generation does not
# connect to PostgreSQL, so use a deliberately non-secret, unreachable build-only
# placeholder instead of injecting a real database credential into image layers.
RUN DATABASE_URL="postgresql://build_only:unused@127.0.0.1:5432/build_only" npx prisma generate

# Keep the same non-secret placeholder available while Nuxt/Nitro bundles server
# modules that import Prisma. Runtime DATABASE_URL is provided separately by Docker.
RUN DATABASE_URL="postgresql://build_only:unused@127.0.0.1:5432/build_only" npm run build

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
