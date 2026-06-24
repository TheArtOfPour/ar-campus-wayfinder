# AR Campus Wayfinder - Docker Deployment

This app can be deployed using Docker alongside the existing Git-based Render.com deployment.

## Local Docker Build and Run

```bash
# Build the image
docker build -t ar-campus-wayfinder .

# Run locally
docker run -p 3000:3000 ar-campus-wayfinder
```

Visit http://localhost:3000 to test.

## Render.com Docker Deployment

The `render.yaml` file configures Render.com to deploy via Docker. To use it:

1. Connect your repository in Render.com
2. Select "Deploy from repo" and choose the `render.yaml` file
3. The service will be deployed at: `https://ar-wayfinder.onrender.com`

## Manual Docker Deployment

```bash
# Build locally
docker build -t ar-wayfinder:latest .

# Push to registry (Docker Hub)
docker tag ar-wayfinder:latest yourusername/ar-wayfinder:latest
docker push yourusername/ar-wayfinder:latest

# Or use Render's built-in registry
# See https://render.com/docs/docker-registry for details
```

## Environment Variables

No additional environment variables are required. The app uses:
- `NODE_ENV` (default: production)
- PORT is automatically set by the platform

## Notes

- This Docker image serves the production build of the A-Frame AR application
- The app requires a device with GPS and camera access (mobile devices for AR)
- LocAR.js will handle GPS positioning automatically on first load
