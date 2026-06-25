# Build stage - build the app
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

# Production stage - serve static files directly via nginx
FROM nginx:alpine

# Install certbot and openssl for SSL support
RUN apk add --no-cache certbot openssl

# Copy built app from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Create directories for Let's Encrypt challenges and self-signed certs
RUN mkdir -p /var/www/html/.well-known/acme-challenge && \
    chown -R nginx:nginx /var/www/html

# Generate self-signed certificate as fallback (with proper error handling)
RUN set -e && \
    mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/ssl/selfsigned.key \
        -out /etc/nginx/ssl/selfsigned.crt \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" 2>/dev/null || true

# Replace default nginx config with our custom one (inline)
RUN rm /etc/nginx/conf.d/default.conf

COPY <<'EOF' /etc/nginx/conf.d/ar-wayfinder.conf
upstream ar_wayfinder_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name _;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/nginx/ssl/selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/selfsigned.key;
    ssl_session_timeout 1d;
    ssl_session_cache shared:MozSSL:10m;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
EOF

# Create entrypoint script that handles both domain and IP scenarios
COPY <<'SCRIPT' /entrypoint.sh
#!/bin/sh

DOMAIN="${DOMAIN_NAME:-localhost}"
EMAIL="${ADMIN_EMAIL:-admin@localhost}"

echo "Starting AR Wayfinder..."
echo "Domain: ${DOMAIN}"

# Skip Let's Encrypt if using IP address or localhost
if [ "$DOMAIN" != "localhost" ] && [ -n "$DOMAIN" ] && ! echo "$DOMAIN" | grep -qE '^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$'; then
    # Try to obtain/renew certificate
    if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
        echo "Attempting Let's Encrypt certificate for ${DOMAIN}..."
        
        # Create webroot directory if needed
        mkdir -p /var/www/html/.well-known/acme-challenge
        
        certbot certonly --webroot \
            -w /var/www/html \
            -d "$DOMAIN" \
            --non-interactive \
            --agree-tos \
            --email "$EMAIL" \
            --server https://acme-v02.api.letsencrypt.org/directory 2>&1 || true
    fi
    
    # Try to renew certificate if it exists and is close to expiration
    certbot renew --quiet 2>/dev/null || true
fi

# Start nginx in foreground
nginx -g 'daemon off;'
SCRIPT

RUN chmod +x /entrypoint.sh

EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
CMD []
