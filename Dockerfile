# StreetWise ZW API (apps/api) — built from the monorepo root so packages/shared is available.
FROM node:22.18.0-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
# shared's `prepare` compiles it during install, so its sources must be present first.
COPY packages/shared/ packages/shared/

RUN pnpm install --frozen-lockfile

COPY apps/api/ apps/api/
RUN pnpm -F @streetwise/shared build && pnpm -F @streetwise/api build

FROM node:22.18.0-alpine
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate
RUN apk add --no-cache tini

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 8080
WORKDIR /app/apps/api
ENTRYPOINT ["tini", "--", "docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
