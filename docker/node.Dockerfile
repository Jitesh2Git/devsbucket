# syntax=docker/dockerfile:1
# Image for realtime or worker (Phase 6). Node runs their TypeScript
# directly, as in dev, so there's no build: the image holds the app, the
# workspace packages it imports (as source) and their production
# dependencies. Build from the repo root:
#   docker build -f docker/node.Dockerfile --build-arg APP=realtime -t devsbucket-realtime .
#   docker build -f docker/node.Dockerfile --build-arg APP=worker -t devsbucket-worker .

ARG NODE_IMAGE=node:24.21.0-trixie-slim

FROM ${NODE_IMAGE} AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
# pnpm at the version in package.json's packageManager.
RUN corepack enable
WORKDIR /repo

# Only the app and the workspace packages it depends on, plus a lockfile
# cut down to them. json/ is just the package.json files, so the install
# layer below stays cached until a dependency changes.
FROM base AS prune
ARG APP
RUN test -n "$APP" || (echo "Set --build-arg APP=realtime or APP=worker" && exit 1)
COPY . .
RUN pnpm dlx turbo@2.11.13 prune "$APP" --docker

FROM base AS install
COPY --from=prune /repo/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod
COPY --from=prune /repo/out/full/ ./

FROM ${NODE_IMAGE} AS app
ARG APP
ENV NODE_ENV=production
COPY --from=install --chown=node:node /repo /repo
WORKDIR /repo/apps/${APP}
USER node
CMD ["node", "src/index.ts"]