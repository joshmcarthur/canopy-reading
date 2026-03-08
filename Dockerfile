# Builder stage
FROM node:lts-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build

# Runtime stage - use minimal alpine base
FROM node:lts-alpine
WORKDIR /app

# Create minimal production package.json excluding build-time dependencies
COPY package*.json ./
RUN apk add --no-cache jq && \
    jq '{name, type, dependencies: (.dependencies | with_entries(select(.key | IN("typescript", "@astrojs/check", "tailwindcss", "@tailwindcss/vite") | not)))}' package.json > package.prod.json && \
    mv package.prod.json package.json && \
    npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force && \
    apk del jq

# Aggressively clean up node_modules to reduce size
RUN find node_modules -type d \( \
        -name "test" -o -name "tests" -o -name "__tests__" -o \
        -name "docs" -o -name "doc" -o \
        -name "examples" -o -name "example" -o \
        -name "*.test.js" -o -name "*.test.ts" \
    \) -exec rm -rf {} + 2>/dev/null || true && \
    find node_modules -type f \( \
        -name "*.md" -o -name "*.map" -o \
        -name "CHANGELOG*" -o -name "LICENSE*" -o -name "README*" -o \
        -name "*.ts" -o -name "*.tsx" \
    \) ! -path "*/node_modules/@types/*" ! -path "*/node_modules/typescript/*" -delete 2>/dev/null || true && \
    # Remove unnecessary directories and caches
    rm -rf /tmp/* /var/cache/apk/* /root/.npm /root/.node-gyp

# Copy built application
COPY --from=builder /app/dist ./dist

# Remove package files (not needed at runtime)
RUN rm -f package*.json

# Create non-root user for security and smaller footprint
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 4321
ENV HOST=0.0.0.0
ENV PORT=4321
ENV NODE_ENV=production

CMD ["node", "dist/server/entry.mjs"]
