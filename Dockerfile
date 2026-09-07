FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN chmod +x docker-entrypoint.sh

# DATABASE_URL is provided at runtime by the environment / compose file.
# Build-time Prisma generation does not require live database access.
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
