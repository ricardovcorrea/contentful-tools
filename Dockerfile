# ── Stage 1: install all deps (needed for build) ────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Stage 3: production-only deps ────────────────────────────────────────────
FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 4: final image ─────────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app

# Upgrade all Alpine packages to their latest patched versions to eliminate
# known CVEs in base OS packages (libssl, busybox, libcrypto, etc.)
RUN apk update && apk upgrade --no-cache && rm -rf /var/cache/apk/*

# Run as non-root for security
RUN addgroup -S app && adduser -S app -G app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json ./

ENV PORT=3000
EXPOSE 3000

USER app
CMD ["npm", "run", "start:node"]