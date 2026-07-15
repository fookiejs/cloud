FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/gateway/package.json packages/gateway/
COPY packages/landing/package.json packages/landing/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/cli/package.json packages/cli/
RUN npm ci
COPY . .
RUN npm --workspace @lotaru/web run build
RUN npm --workspace @lotaru/gateway run build
RUN mkdir -p packages/gateway/public && cp -R packages/web/dist/. packages/gateway/public/

FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/packages/gateway /app/packages/gateway
COPY --from=build /app/node_modules /app/node_modules
WORKDIR /app/packages/gateway
EXPOSE 8080
CMD ["node", "dist/main.js"]
