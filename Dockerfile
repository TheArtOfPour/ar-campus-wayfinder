# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git python3 make g++

COPY package*.json ./
RUN npm ci && npm cache clean --force

COPY scripts/ ./scripts/
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./

RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create directories for Let's Encrypt challenges
RUN mkdir -p /var/www/html/.well-known/acme-challenge && \
    mkdir -p /etc/letsencrypt/{live,archive}

# Set proper permissions
RUN chown -R nginx:nginx /var/www/html && \
    chown -R nginx:nginx /etc/letsencrypt

# Nginx config
RUN rm /etc/nginx/conf.d/default.conf

COPY <<'EOF' /etc/nginx/conf.d/ar-wayfinder.conf
upstream ar_wayfinder_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name _;

    # Let's Encrypt challenge handler
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name _;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.yourdomain.com/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozSSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://ar_wayfinder_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }

    # Serve static files directly
    location /dist/ {
        alias /usr/share/nginx/html/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Create entrypoint script that handles both SSL and non-SSL cases
COPY <<'SCRIPT' /entrypoint.sh
#!/bin/sh

DOMAIN="${DOMAIN_NAME:-localhost}"
EMAIL="${ADMIN_EMAIL:-admin@localhost}"

echo "Starting AR Wayfinder..."

# Only try to get Let's Encrypt cert if we have a valid domain
if [ "$DOMAIN" != "localhost" ] && [ -n "$DOMAIN" ]; then
    # Try to obtain/renew certificate
    if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
        echo "Attempting Let's Encrypt certificate for ${DOMAIN}..."
        certbot certonly --webroot -w /var/www/html \
            -d "$DOMAIN" \
            --non-interactive \
            --agree-tos \
            --email "$EMAIL" \
            --server https://acme-v02.api.letsencrypt.org/directory 2>&1 || true
    fi
fi

# Start nginx
nginx -g 'daemon off;'
SCRIPT

RUN chmod +x /entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
CMD []
