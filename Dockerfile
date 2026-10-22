# An app made from the starting kit. No build step; the image is the source
# tree plus Node, with the tools better-sqlite3 needs to build (the records,
# docs/NEW-APP.md "When the app keeps records" in the kit).
FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV PORT=8080
ENV NODE_ENV=production
ENV DATA_DIR=/data
EXPOSE 8080

CMD ["node", "server.js"]
