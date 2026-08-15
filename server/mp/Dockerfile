# Multiplayer WebSocket server only (Railway / Fly / Render)
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server/mp ./server/mp
ENV PORT=8787
EXPOSE 8787
CMD ["node", "server/mp/index.mjs"]
