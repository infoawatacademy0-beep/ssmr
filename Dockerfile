# ── Stage 1: Build Frontend SPA ──
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Copy application source code
COPY . .

# Build the optimized production bundle (dist/)
RUN npm run build

# ── Stage 2: Production Runtime ──
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy compiled frontend assets from builder
COPY --from=builder /app/dist ./dist

# Copy backend server script
COPY server.js ./

# Set security non-root user
USER node

# Expose server port
EXPOSE 3000

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application server (Express serving frontend + LiveKit API)
CMD ["npm", "start"]
