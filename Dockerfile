FROM node:19-slim

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install
COPY . .

ENTRYPOINT ["yarn"]
CMD ["start"]
