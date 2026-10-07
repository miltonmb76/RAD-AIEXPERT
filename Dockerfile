FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

# System fonts as fallback for SVG text (resvg also loads bundled TTF files)
RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-liberation fonts-dejavu-core fontconfig \
  && fc-cache -f \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.cjs ./server.cjs
COPY --from=build /app/server.cjs.map ./server.cjs.map
COPY firebase-applet-config.json ./
# Bundled fonts for patient infographic SVG→PNG via @resvg/resvg-js
COPY --from=build /app/assets/fonts ./assets/fonts

USER node
EXPOSE 8080

CMD ["node", "server.cjs"]
