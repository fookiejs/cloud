FROM node:lts-alpine
WORKDIR /usr/src/app
COPY package.json .
COPY . .
RUN npm install
CMD [ "node",  "./index.js" ]


