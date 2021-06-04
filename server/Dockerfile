FROM node:lts-alpine
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --save
COPY . .
CMD [ "npm","run","start" ]