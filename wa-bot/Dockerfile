FROM node:24-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY index.js cli.js ./
RUN mkdir -p /data/auth
VOLUME ["/data"]
CMD ["node", "index.js"]
