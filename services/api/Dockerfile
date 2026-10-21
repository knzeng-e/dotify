FROM node:22.13.1-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22.13.1-slim AS runtime-base

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Application code stays root-owned/read-only to node. Only local default state
# is writable; mounted Fly storage requires explicit offline preparation.
RUN test "$(id -u node)" = 1000 && test "$(id -g node)" = 1000 \
    && mkdir -p /app/.data && chown node:node /app/.data && chmod 700 /app/.data

# Explicit one-shot target, never the default deployment image. Does not import
# the API/configuration or start a server; inspection is read-only by default.
FROM runtime-base AS storage-maintenance
USER root
CMD ["node", "dist/scripts/prepareApiStorage.js", "--inspect"]

FROM runtime-base AS runner
USER node
# Start Node directly so SIGTERM reaches the graceful shutdown handler.
CMD ["node", "dist/index.js"]

