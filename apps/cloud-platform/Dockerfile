FROM golang:1.26-alpine AS auth-module
WORKDIR /repo/auth
RUN apk add --no-cache ca-certificates git
COPY auth/go.mod auth/go.sum ./
RUN go mod download
COPY auth ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/auth ./cmd/server

FROM node:26-bookworm-slim AS task-module
WORKDIR /repo/apps/task-bridge/apps/backend
COPY apps/task-bridge/apps/backend/package.json apps/task-bridge/apps/backend/package-lock.json ./
RUN npm ci
COPY apps/task-bridge/apps/backend ./
RUN npm run build

FROM node:26-bookworm-slim AS build
WORKDIR /repo/apps/cloud-platform
COPY apps/cloud-platform/package.json apps/cloud-platform/package-lock.json ./
COPY apps/cloud-platform/packages ./packages
RUN npm ci
COPY --from=task-module /repo/apps/task-bridge/apps/backend/dist /repo/apps/task-bridge/apps/backend/dist
RUN npm run build:web
RUN npx tsc -p packages/server/tsconfig.json

FROM node:26-bookworm-slim
WORKDIR /app/apps/cloud-platform
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data
ENV EMBEDDED_AUTH_BINARY=/app/bin/auth
ENV AUTH_PUBLIC_URL=https://auth.fookiecloud.com
# git is needed at runtime: the server itself (not a sandbox container) shells out to
# `git clone`/`push`/`pull` for the per-project GitHub integration.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /repo/apps/cloud-platform/package.json ./
COPY --from=build /repo/apps/cloud-platform/node_modules /app/node_modules
COPY --from=build /repo/apps/cloud-platform/packages/server/dist ./packages/server/dist
COPY --from=build /repo/apps/cloud-platform/packages/web/dist ./packages/web/dist
COPY --from=task-module /repo/apps/task-bridge/apps/backend/dist /app/apps/task-bridge/apps/backend/dist
COPY --from=auth-module /out/auth /app/bin/auth
RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 8080
CMD ["npm", "run", "start"]
