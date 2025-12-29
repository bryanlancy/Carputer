FROM node:20-bullseye-slim AS base
# Use bullseye (Debian 11) which has OpenSSL 1.1 by default
# This avoids compatibility issues with Prisma which requires libssl1.1
# Ensure libssl1.1 is installed
RUN apt-get update && apt-get install -y libssl1.1 && rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package*.json ./
# Copy Prisma schema for client generation
COPY prisma ./prisma
RUN npm ci
# Generate Prisma client (needed for @prisma/client to work)
# This generates TypeScript types from the schema - doesn't need database connection
RUN npx prisma generate

# Development image with dependencies
FROM base AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
# Note: Source code is mounted via volume in docker-compose.yml
# The named volume backend_node_modules preserves node_modules from this image
# Prisma schema will be available from the mounted volume
EXPOSE 3001
ENV PORT 3001
CMD ["sh", "-c", "npm install && npx prisma generate && npm run dev"]

# Production build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Regenerate Prisma client with updated schema
RUN npx prisma generate
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3001
ENV PORT 3001
CMD ["npm", "start"]

