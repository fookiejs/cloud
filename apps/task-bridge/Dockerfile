FROM node:26-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/package-lock.json apps/backend/
COPY apps/web/package.json apps/web/package-lock.json apps/web/
RUN npm ci --ignore-scripts
RUN npm --prefix apps/backend ci
RUN npm --prefix apps/web ci
COPY . .
RUN npm --prefix apps/web run build
RUN node scripts/copy-web.mjs
RUN npm --prefix apps/backend run build

FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV FOOKIE_MODE=1
ENV FOOKIE_AUTH_ISSUER=https://auth.fookiecloud.com
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/package.json /app/apps/backend/package-lock.json ./apps/backend/
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/public ./apps/backend/public
EXPOSE 3000
CMD ["node", "apps/backend/dist/index.js"]
