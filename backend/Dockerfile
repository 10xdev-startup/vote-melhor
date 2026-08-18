FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json

RUN npm ci --workspace=backend --include-workspace-root

FROM dependencies AS builder

COPY backend ./backend
RUN npm run build --workspace=backend

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 apiuser

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN npm ci --omit=dev --workspace=backend --include-workspace-root \
  && npm cache clean --force

COPY --from=builder --chown=apiuser:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=apiuser:nodejs /app/backend/certs ./backend/certs

ENV NODE_EXTRA_CA_CERTS=/app/backend/certs/icp-brasil-v10.crt

WORKDIR /app/backend
USER apiuser

EXPOSE 8000
CMD ["npm", "start"]
