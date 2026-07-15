FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY web ./web
COPY src ./src
RUN npm run build:web

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
COPY package.json ./
COPY src ./src
COPY --from=build /app/public ./public
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "src/server.js"]
