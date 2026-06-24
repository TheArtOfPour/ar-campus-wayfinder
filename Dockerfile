FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better caching)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

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
