FROM node:lts-alpine
RUN npm install --global nodemon
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --save
COPY . .
CMD [ "npm","run","start" ]