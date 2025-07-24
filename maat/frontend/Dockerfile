# Dockerfile
FROM node:18

WORKDIR /app

COPY server /app

RUN npm install

CMD ["npx", "ts-node", "server.ts"]
