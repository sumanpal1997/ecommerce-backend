# Build stage
FROM node:20-slim AS builder
WORKDIR /app

# Copy package descriptors
COPY package*.json ./
RUN npm ci

# Copy source code and build TypeScript to dist
COPY . .
RUN npm run build

# Production runtime stage
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled artifacts from builder
COPY --from=builder /app/dist ./dist

# Create non-root user for security
USER node

EXPOSE 5000

CMD ["node", "dist/app/server.js"]
