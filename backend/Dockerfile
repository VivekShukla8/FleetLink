# ─────────────────────────────────────────────────────────
# Dockerfile — FleetLink Backend (Node.js)
# ─────────────────────────────────────────────────────────
# Multi-stage build to minimize final image size.
# Stage 1 (builder): install ALL deps + generate Prisma
# Stage 2 (runner):  copy only production deps + source

# ── Stage 1: Build ───────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
RUN npx prisma generate

# ── Stage 2: Production ─────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files and install ONLY production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client from builder (Prisma v7 generates to src/generated/)
COPY --from=builder /app/src/generated ./src/generated

# Copy application source + prisma schema (for migrations)
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src ./src

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
