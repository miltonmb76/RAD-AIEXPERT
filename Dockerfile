FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm run build:msk-smoke

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
COPY --from=build /app/msk-render-smoke.mjs ./msk-render-smoke.mjs
COPY firebase-applet-config.json ./

RUN mkdir -p /tmp/rad-ai-font-cache && chown node:node /tmp/rad-ai-font-cache

USER node
# Fail the build if real runtime fonts, PNG composition or PDF embedding fail.
# Uses neutral image fixtures; no API calls, credentials or patient data.
RUN node msk-render-smoke.mjs
EXPOSE 8080

CMD ["node", "server.cjs"]
