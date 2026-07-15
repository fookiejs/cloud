FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data
COPY package.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p /data
EXPOSE 3000
CMD ["node", "src/server.js"]
