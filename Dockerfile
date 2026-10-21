FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080
ENV XDG_CACHE_HOME=/tmp/rad-ai-font-cache
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.cjs ./server.cjs
COPY --from=build /app/server.cjs.map ./server.cjs.map
COPY --from=build /app/assets/fonts ./assets/fonts
COPY firebase-applet-config.json ./

RUN mkdir -p /tmp/rad-ai-font-cache && chown node:node /tmp/rad-ai-font-cache

USER node
EXPOSE 8080

CMD ["node", "server.cjs"]
