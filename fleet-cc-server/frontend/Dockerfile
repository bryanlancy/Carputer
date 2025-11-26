FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Development image with dependencies
FROM base AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
# Note: Source code is mounted via volume in docker-compose.yml
# The anonymous volume /app/node_modules preserves node_modules from this image
EXPOSE 3000
ENV PORT 3000
CMD ["sh", "-c", "npm install --legacy-peer-deps && npm run dev"]

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure public directory exists (even if empty) for Next.js standalone build
RUN mkdir -p public
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build (includes public directory if it existed)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]

