# SearTune API (+ optional bundled web client). Multi-stage so the runtime image
# carries only compiled JS + production deps. Build from the repo root:
#   docker build -t seartune-api .
#   docker run -p 8788:8788 --env-file server/.env seartune-api

# ── build ───────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app/server
# Toolchain for better-sqlite3's native build (local-dev driver; harmless in prod).
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build && npm prune --omit=dev

# ── runtime ─────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/server
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/dist ./dist
COPY --from=build /app/server/package.json ./package.json
# Bundle the web client so SERVE_CLIENT=true can serve it from the same origin.
COPY mvp /app/mvp
EXPOSE 8788
CMD ["node", "dist/index.js"]
