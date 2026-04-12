FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY . .

RUN chmod +x docker-entrypoint.sh

ARG DATABASE_URL=postgresql://van_dashboard:van1234@db:5432/association_dashboard?schema=public
ENV DATABASE_URL=$DATABASE_URL

RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]