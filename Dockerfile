# Base image for dependencies
FROM node:18-alpine AS base
WORKDIR /app

# === Install dependencies ===
FROM base AS deps

# Copy root and server package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install root deps (with Vite and others)
RUN npm install --legacy-peer-deps

# Install server deps
WORKDIR /app/server
RUN npm install --legacy-peer-deps

# === Build frontend ===
FROM base AS builder
WORKDIR /app

# Copy source code and deps
COPY . .
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules

# Build Vite frontend
RUN npm run build

# === Final production image ===
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Add app user
RUN addgroup -S nodejs && adduser -S appuser -G nodejs
USER appuser

# Copy built frontend and backend
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=deps /app/server/node_modules ./server/node_modules

# Set environment
ENV PORT=3000

# Start backend server
CMD ["node", "server/app.js"]
