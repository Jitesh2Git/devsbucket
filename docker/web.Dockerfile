# syntax=docker/dockerfile:1
# Image for the web app (Phase 6): Next.js built inside the image with
# `output: "standalone"`, so the final image holds only the files the server
# needs. Build from the repo root:
#   docker build -f docker/web.Dockerfile \
#     --build-arg NEXT_PUBLIC_REALTIME_URL=wss://devsbucket.duckdns.org/realtime \
#     -t devsbucket-web .
# Server settings (DATABASE_URL, BETTER_AUTH_*, GITHUB_*, S3_*) are read at
# run time, so one image works with any .env. NEXT_PUBLIC_* values are baked
# into the browser code at build time, hence the build argument.

ARG NODE_IMAGE=node:24.21.0-trixie-slim

FROM ${NODE_IMAGE} AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.13 prune web --docker

FROM base AS build
COPY --from=prune /repo/out/json/ ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ ./
ARG NEXT_PUBLIC_REALTIME_URL
RUN test -n "$NEXT_PUBLIC_REALTIME_URL" || (echo "Set --build-arg NEXT_PUBLIC_REALTIME_URL" && exit 1)
ENV NEXT_PUBLIC_REALTIME_URL=${NEXT_PUBLIC_REALTIME_URL} \
    NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1
# The server code checks its settings when it loads, and the build loads
# it. These placeholders exist only for this command (nothing connects
# during the build, and they aren't kept in the image); the real values come
# from the environment when the container runs.
RUN DATABASE_URL=postgres://build:build@127.0.0.1:1/build \
    BETTER_AUTH_SECRET=build-only-placeholder-not-a-real-secret \
    BETTER_AUTH_URL=http://localhost:3000 \
    S3_ENDPOINT=http://127.0.0.1:1 S3_REGION=build S3_BUCKET=build \
    S3_ACCESS_KEY_ID=build S3_SECRET_ACCESS_KEY=build \
    pnpm --filter web build

FROM ${NODE_IMAGE} AS app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# The standalone server and its traced node_modules, then the browser's
# static files, which standalone leaves out.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]