FROM node:20-alpine

WORKDIR /app

# Install build dependencies (git for version, node-gyp, etc.)
RUN apk add --no-cache git python3 make g++

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci && npm cache clean --force

# Copy all source files including scripts
COPY scripts/ ./scripts/
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

# Build the app for production
RUN npm run build

# Expose port
EXPOSE 3000

# Serve the built app
CMD ["npx", "serve", "-s", "dist", "-l", "3000"]
