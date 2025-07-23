# Base image
FROM node:18-alpine AS base
WORKDIR /app
ENV NODE_ENV production

# === Install dependencies ===
FROM base AS deps

# Copy package files for root and server
COPY package*.json ./
COPY server/package*.json ./server/

# Install root dependencies with legacy-peer-deps
RUN npm install --legacy-peer-deps

# Install server dependencies with legacy-peer-deps
WORKDIR /app/server
RUN npm install --legacy-peer-deps

# === Build frontend ===
FROM base AS builder

# Copy full source and installed deps
COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules

# Build using Vite
RUN npm run build

# === Final stage for production ===
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# Add non-root user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

# Copy built assets and server
COPY --from=builder /app/dist ./public
COPY --from=builder /app/server ./server
COPY --from=deps /app/server/node_modules ./server/node_modules

# Set runtime environment
EXPOSE 3000
ENV PORT=3000

# Start backend server
CMD ["node", "server/app.js"]
