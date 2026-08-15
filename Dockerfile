# Client build
FROM node:20-slim AS client-builder
WORKDIR /app/client
COPY client/package.json client/package-lock.json* ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Server build
FROM node:20-slim AS server-builder
WORKDIR /app/server
COPY server/package.json server/package-lock.json* ./
RUN npm ci
COPY server/prisma ./prisma
RUN npx prisma generate
COPY server/ ./
RUN npm run build

# Production
FROM node:20-slim
WORKDIR /app
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=server-builder /app/server/prisma ./server/prisma
COPY --from=server-builder /app/server/package.json ./server/package.json
COPY --from=client-builder /app/client/dist ./client/dist
COPY package.json ./
RUN mkdir -p /app/data /app/uploads

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL="file:./data/dipstick.db"
ENV UPLOAD_DIR=/app/uploads

EXPOSE 3001

CMD ["sh", "-c", "cd /app/server && npx prisma db push --accept-data-loss && (npx tsx prisma/seed.ts || true) && node dist/index.js"]
