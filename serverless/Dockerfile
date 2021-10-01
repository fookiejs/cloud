FROM node
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm i 
RUN npm i serverless
RUN npm i serverless-offline
COPY . .
EXPOSE 3000
CMD ["npm","run","dev"]