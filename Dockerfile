# Base image
FROM node:18-alpine AS base
WORKDIR /app

# === Install dependencies ===
FROM base AS deps

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install root dependencies (include dev so vite is available)
RUN npm install --legacy-peer-deps

# Install server dependencies
WORKDIR /app/server
RUN npm install --legacy-peer-deps

# === Build frontend ===
FROM base AS builder

# Copy full source code
COPY . .

# Copy node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules

# Build frontend using Vite
RUN npm run build

# === Final stage for production ===
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Add non-root user
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
USER nextjs

# Copy built frontend and backend
COPY --from=builder /app/dist ./public
COPY --from=builder /app/server ./server
COPY --from=deps /app/server/node_modules ./server/node_modules

# Expose port and run server
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server/app.js"]
