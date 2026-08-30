FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files and install ALL deps (including devDeps needed for build)
COPY package.json package-lock.json ./
RUN npm ci

# ─── Builder stage ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Re-use installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js app in standalone mode
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Runner (production image) ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy the standalone output (includes server.js + all required files)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static
COPY --from=builder /app/public           ./public

EXPOSE 3000

# next.js standalone server entry-point
CMD ["node", "server.js"]
