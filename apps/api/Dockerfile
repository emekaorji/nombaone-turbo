# syntax=docker/dockerfile:1

FROM node:22-bullseye AS base
RUN corepack enable && corepack prepare pnpm@9 --activate

# --- Prune stage: extract only what api needs ---
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@2.10.0
COPY . .
RUN turbo prune @nombaone/api --docker

# --- Build stage: install deps + bundle ---
FROM base AS builder
WORKDIR /app

COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

COPY --from=pruner /app/out/full/ .
RUN pnpm turbo build --filter=@nombaone/api

# Prune to production deps only
RUN pnpm prune --prod

# --- Runtime stage: minimal production image ---
FROM node:22-bullseye-slim AS production
ENV NODE_ENV=production
WORKDIR /app/apps/api

# tsup bundles `@nombaone/*` workspace packages into dist/. Third-party deps stay
# external and are resolved at runtime, so we need both the workspace-root
# node_modules (where pnpm's .pnpm store lives) and the api package's own
# node_modules (which holds the direct-dep symlinks pointing into the store).
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/apps/api/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json
COPY --from=builder /app/apps/api/dist ./dist

EXPOSE 8000

CMD ["node", "dist/server.mjs"]
