# AR Campus Wayfinder - Production HTTPS Setup

## Prerequisites Checklist

- [ ] Rocky Linux server (8.x or 9.x)
- [ ] Docker CE installed (`sudo dnf install docker -y && sudo systemctl start docker`)
- [ ] Domain name pointing to your server's public IP
- [ ] Ports 80 and 443 open in firewall

## Step 1: Update Dockerfile for SSL Support

The `Dockerfile` has been updated with:
- Multi-stage build (build app + serve via nginx)
- Let's Encrypt certificate management
- HTTP to HTTPS redirect
- Nginx reverse proxy for the Node.js app

```bash
# Verify the Dockerfile exists
cat Dockerfile | head -20
```

## Step 2: Build and Run with Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  ar-wayfinder:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ar-wayfinder
    ports:
      - "80:80"
      - "443:443"
    environment:
      - DOMAIN_NAME=ar.example.com  # Replace with your domain
      - ADMIN_EMAIL=admin@example.com  # For certificate notifications
    restart: unless-stopped
    volumes:
      - letsencrypt-data:/etc/letsencrypt

volumes:
  letsencrypt-data:
```

Run:

```bash
# Build and start in detached mode
docker-compose up -d --build

# Check status
docker-compose ps
```

## Step 3: Configure Firewall (Rocky Linux)

```bash
# Enable and start firewalld if not running
sudo systemctl enable --now firewalld

# Add HTTP and HTTPS services
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-all
```

## Step 4: Obtain SSL Certificate (Let's Encrypt)

The Docker container will automatically request certificates on first run if:
- `DOMAIN_NAME` environment variable is set
- Your domain points to the server IP
- Ports 80/443 are accessible

Check logs:

```bash
docker logs ar-wayfinder | grep -i certificate
```

## Step 5: Test HTTPS Deployment

```bash
# Test from local machine (not the server)
curl https://your-domain.com
# or visit in browser:
https://your-domain.com
```

## Manual Docker Run (Alternative)

If you prefer running without docker-compose:

```bash
# Create volume for certificates
docker volume create letsencrypt-data

# Run container
docker run -d \
  --name ar-wayfinder \
  -p 80:80 \
  -p 443:443 \
  -e DOMAIN_NAME=ar.example.com \
  -e ADMIN_EMAIL=admin@example.com \
  -v letsencrypt-data:/etc/letsencrypt \
  --restart unless-stopped \
  ar-wayfinder:latest
```

## Certificate Management

### Check certificate status:

```bash
# Inside container
docker exec ar-wayfinder ls -la /etc/letsencrypt/live/
docker exec ar-wayfinder certbot certificates
```

### Manually renew (if needed):

```bash
docker exec ar-wayfinder certbot renew --dry-run
```

## Monitoring

```bash
# View live logs
docker logs -f ar-wayfinder

# Check container health
docker inspect ar-wayfinder --format='{{.State.Status}}'

# Verify HTTPS is working
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

## Troubleshooting

### Certificate not being issued:

1. Check domain DNS points to server IP:
   ```bash
   nslookup your-domain.com
   ```

2. Verify ports are open:
   ```bash
   # From external machine (not the server)
   curl http://your-domain.com/.well-known/acme-challenge/test
   ```

3. Check firewall rules

### Container won't start:

```bash
# Check logs
docker logs ar-wayfinder

# Check if port is already in use
sudo ss -tulpn | grep ':80\|:443'
```

## Auto-Renewal Setup

Let's Encrypt certificates expire after 90 days. The certbot installation automatically attempts renewal twice daily. You can verify:

```bash
# Test renewal process (dry run)
docker exec ar-wayfinder certbot renew --dry-run
```

## Security Hardening (Optional)

Add these to your nginx config for enhanced security:

```nginx
# In the HTTPS server block, add:
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

---

**Next Steps:**
1. Replace `your-domain.com` with your actual domain
2. Point DNS A record to server IP
3. Run the docker-compose command
4. Visit https://your-domain.com to test
