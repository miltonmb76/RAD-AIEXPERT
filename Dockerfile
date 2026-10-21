FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run test:msk && npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.cjs ./server.cjs
COPY --from=build /app/server.cjs.map ./server.cjs.map
COPY firebase-applet-config.json ./
COPY scripts/msk-pdf-smoke.mjs ./msk-pdf-smoke.mjs

USER node
# Offline regression check: no AI calls, credentials or patient data.
RUN node msk-pdf-smoke.mjs
EXPOSE 8080

CMD ["node", "server.cjs"]
