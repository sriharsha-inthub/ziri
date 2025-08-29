# Ziri Docker Setup Guide

This guide covers containerized deployment of Ziri using Docker, including development environments, production deployments, and CI/CD integration.

## Quick Start

### Basic Docker Usage

```bash
# Pull the official Ziri image (when available)
docker pull ziri/ziri:latest

# Or build from source
git clone https://github.com/ziri-ai/ziri.git
cd ziri
docker build -t ziri .

# Run Ziri in a container
docker run -v $(pwd):/workspace -e OPENAI_API_KEY=sk-your-key ziri index
```

## Docker Images

### Official Images

```bash
# Latest stable version
docker pull ziri/ziri:latest

# Specific version
docker pull ziri/ziri:0.1.1

# Development version
docker pull ziri/ziri:dev

# Minimal Alpine-based image
docker pull ziri/ziri:alpine
```

### Image Variants

| Tag | Base Image | Size | Use Case |
|-----|------------|------|----------|
| `latest` | `node:18` | ~200MB | General use |
| `alpine` | `node:18-alpine` | ~100MB | Minimal deployments |
| `dev` | `node:18` | ~250MB | Development with tools |
| `python` | `python:3.11` | ~180MB | Python-based deployment |

## Building Custom Images

### Basic Dockerfile

```dockerfile
# Dockerfile
FROM node:18-alpine

# Install Ziri
RUN npm install -g ziri

# Create app directory
WORKDIR /workspace

# Copy configuration template
COPY docker/ziri-config.json /root/.ziri/config.json

# Set environment variables
ENV ZIRI_LOG_LEVEL=info
ENV ZIRI_HOME=/root/.ziri

# Create volume for persistent data
VOLUME ["/root/.ziri"]

# Default command
CMD ["ziri", "--help"]
```

### Multi-stage Build

```dockerfile
# Multi-stage Dockerfile for optimized production image
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy source code
COPY packages/ziri-js /app
WORKDIR /app

# Install dependencies and build
RUN npm ci --only=production
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S ziri && \
    adduser -S ziri -u 1001

# Copy built application
COPY --from=builder /app/dist /app
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json

# Set ownership
RUN chown -R ziri:ziri /app

# Switch to non-root user
USER ziri

# Set working directory
WORKDIR /workspace

# Set environment variables
ENV NODE_ENV=production
ENV ZIRI_LOG_LEVEL=info

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node /app/bin/ziri.js --version || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "/app/bin/ziri.js"]
```

### Development Dockerfile

```dockerfile
# Dockerfile.dev
FROM node:18

# Install development tools
RUN apt-get update && apt-get install -y \
    git \
    vim \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install global development dependencies
RUN npm install -g nodemon typescript ts-node

# Create app directory
WORKDIR /app

# Copy package files
COPY packages/ziri-js/package*.json ./

# Install dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY packages/ziri-js .

# Build the application
RUN npm run build

# Create workspace directory
WORKDIR /workspace

# Set development environment
ENV NODE_ENV=development
ENV ZIRI_LOG_LEVEL=debug

# Expose debug port
EXPOSE 9229

# Default command for development
CMD ["npm", "run", "dev"]
```

## Docker Compose Configurations

### Basic Development Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  ziri:
    build: .
    volumes:
      - .:/workspace
      - ziri-data:/root/.ziri
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ZIRI_LOG_LEVEL=debug
    working_dir: /workspace
    command: ziri index --verbose

  # Optional: Ollama for local embeddings
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-data:/root/.ollama
    environment:
      - OLLAMA_ORIGINS=*

volumes:
  ziri-data:
  ollama-data:
```

### Production Setup

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  ziri:
    image: ziri/ziri:latest
    restart: unless-stopped
    volumes:
      - ./repositories:/workspace
      - ziri-data:/root/.ziri
      - ./config:/config
    environment:
      - OPENAI_API_KEY_FILE=/run/secrets/openai_api_key
      - ZIRI_LOG_LEVEL=info
      - ZIRI_CONFIG_FILE=/config/ziri.json
    secrets:
      - openai_api_key
    healthcheck:
      test: ["CMD", "ziri", "--version"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Redis for caching (optional)
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes:
      - redis-data:/data
    command: redis-server --appendonly yes

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

secrets:
  openai_api_key:
    file: ./secrets/openai_api_key.txt

volumes:
  ziri-data:
  redis-data:
  prometheus-data:
```

### Multi-Repository Processing

```yaml
# docker-compose.multi-repo.yml
version: '3.8'

services:
  ziri-frontend:
    image: ziri/ziri:latest
    volumes:
      - ./frontend:/workspace
      - ziri-frontend-data:/root/.ziri
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ZIRI_REPOSITORY_ID=frontend
    command: ziri index --verbose

  ziri-backend:
    image: ziri/ziri:latest
    volumes:
      - ./backend:/workspace
      - ziri-backend-data:/root/.ziri
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ZIRI_REPOSITORY_ID=backend
    command: ziri index --verbose

  ziri-shared:
    image: ziri/ziri:latest
    volumes:
      - ./shared:/workspace
      - ziri-shared-data:/root/.ziri
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ZIRI_REPOSITORY_ID=shared
    command: ziri index --verbose

  # Query service
  ziri-query:
    image: ziri/ziri:latest
    ports:
      - "3000:3000"
    volumes:
      - ziri-frontend-data:/data/frontend:ro
      - ziri-backend-data:/data/backend:ro
      - ziri-shared-data:/data/shared:ro
    environment:
      - ZIRI_QUERY_MODE=server
      - ZIRI_DATA_DIRS=/data/frontend,/data/backend,/data/shared
    command: ziri serve --port 3000

volumes:
  ziri-frontend-data:
  ziri-backend-data:
  ziri-shared-data:
```

## Environment Configuration

### Environment Variables

```bash
# Core configuration
ZIRI_LOG_LEVEL=info|debug|warn|error
ZIRI_HOME=/root/.ziri
ZIRI_CONFIG_FILE=/config/ziri.json

# Provider configuration
OPENAI_API_KEY=sk-your-key
HUGGINGFACE_API_KEY=hf_your-key
COHERE_API_KEY=your-cohere-key

# Performance settings
ZIRI_CONCURRENCY=4
ZIRI_BATCH_SIZE=50
ZIRI_MEMORY_LIMIT=512

# Storage settings
ZIRI_STORAGE_BACKEND=filesystem|redis|s3
ZIRI_REDIS_URL=redis://redis:6379
ZIRI_S3_BUCKET=ziri-embeddings

# Security
ZIRI_API_KEY_FILE=/run/secrets/api_key
ZIRI_ENCRYPT_STORAGE=true
ZIRI_ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
```

### Configuration Files

```json
// config/ziri.json
{
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "type": "openai",
      "model": "text-embedding-3-small",
      "dimensions": 1536
    },
    "ollama": {
      "type": "ollama",
      "baseUrl": "http://ollama:11434",
      "model": "nomic-embed-text"
    }
  },
  "performance": {
    "concurrency": 4,
    "batchSize": 50,
    "memoryLimit": 512
  },
  "storage": {
    "backend": "filesystem",
    "compression": true,
    "encryption": true
  },
  "logging": {
    "level": "info",
    "format": "json"
  }
}
```

## Kubernetes Deployment

### Basic Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ziri
  labels:
    app: ziri
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ziri
  template:
    metadata:
      labels:
        app: ziri
    spec:
      containers:
      - name: ziri
        image: ziri/ziri:latest
        ports:
        - containerPort: 3000
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ziri-secrets
              key: openai-api-key
        - name: ZIRI_LOG_LEVEL
          value: "info"
        volumeMounts:
        - name: ziri-data
          mountPath: /root/.ziri
        - name: config
          mountPath: /config
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          exec:
            command:
            - ziri
            - --version
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          exec:
            command:
            - ziri
            - doctor
          initialDelaySeconds: 5
          periodSeconds: 10
      volumes:
      - name: ziri-data
        persistentVolumeClaim:
          claimName: ziri-pvc
      - name: config
        configMap:
          name: ziri-config
---
apiVersion: v1
kind: Service
metadata:
  name: ziri-service
spec:
  selector:
    app: ziri
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
```

### ConfigMap and Secrets

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: ziri-config
data:
  ziri.json: |
    {
      "defaultProvider": "openai",
      "performance": {
        "concurrency": 4,
        "batchSize": 50,
        "memoryLimit": 512
      },
      "logging": {
        "level": "info",
        "format": "json"
      }
    }
---
apiVersion: v1
kind: Secret
metadata:
  name: ziri-secrets
type: Opaque
data:
  openai-api-key: <base64-encoded-api-key>
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ziri-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### Horizontal Pod Autoscaler

```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ziri-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ziri
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## CI/CD Integration

### GitHub Actions with Docker

```yaml
# .github/workflows/docker.yml
name: Docker Build and Deploy

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout repository
      uses: actions/checkout@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v2
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v4
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}

    - name: Build and push Docker image
      uses: docker/build-push-action@v4
      with:
        context: .
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}

  test:
    runs-on: ubuntu-latest
    needs: build
    
    steps:
    - name: Checkout repository
      uses: actions/checkout@v3
      
    - name: Test Docker image
      run: |
        docker run --rm \
          -v ${{ github.workspace }}:/workspace \
          -e OPENAI_API_KEY=${{ secrets.OPENAI_API_KEY }} \
          ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.ref_name }} \
          ziri index --dry-run

  deploy:
    runs-on: ubuntu-latest
    needs: [build, test]
    if: github.ref == 'refs/heads/main'
    
    steps:
    - name: Deploy to production
      run: |
        # Add your deployment commands here
        echo "Deploying to production..."
```

### GitLab CI with Docker

```yaml
# .gitlab-ci.yml
stages:
  - build
  - test
  - deploy

variables:
  DOCKER_DRIVER: overlay2
  DOCKER_TLS_CERTDIR: "/certs"

services:
  - docker:20.10.16-dind

before_script:
  - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY

build:
  stage: build
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

test:
  stage: test
  script:
    - docker run --rm 
        -v $PWD:/workspace 
        -e OPENAI_API_KEY=$OPENAI_API_KEY 
        $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA 
        ziri index --dry-run

deploy:
  stage: deploy
  script:
    - docker tag $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA $CI_REGISTRY_IMAGE:latest
    - docker push $CI_REGISTRY_IMAGE:latest
  only:
    - main
```

## Monitoring and Logging

### Prometheus Metrics

```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'ziri'
    static_configs:
      - targets: ['ziri:3000']
    metrics_path: /metrics
    scrape_interval: 30s
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Ziri Metrics",
    "panels": [
      {
        "title": "Indexing Throughput",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(ziri_files_processed_total[5m])",
            "legendFormat": "Files/sec"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "ziri_memory_usage_bytes",
            "legendFormat": "Memory"
          }
        ]
      }
    ]
  }
}
```

### Centralized Logging

```yaml
# docker-compose.logging.yml
version: '3.8'

services:
  ziri:
    image: ziri/ziri:latest
    logging:
      driver: "fluentd"
      options:
        fluentd-address: localhost:24224
        tag: ziri.{{.Name}}

  fluentd:
    image: fluent/fluentd:v1.14-debian-1
    ports:
      - "24224:24224"
    volumes:
      - ./fluentd/conf:/fluentd/etc
      - fluentd-data:/fluentd/log

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data

  kibana:
    image: docker.elastic.co/kibana/kibana:7.17.0
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200

volumes:
  fluentd-data:
  elasticsearch-data:
```

## Security Best Practices

### Secure Configuration

```dockerfile
# Security-focused Dockerfile
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S ziri && \
    adduser -S ziri -u 1001

# Install Ziri
RUN npm install -g ziri

# Set up secure directories
RUN mkdir -p /app/.ziri && \
    chown -R ziri:ziri /app

# Switch to non-root user
USER ziri

# Set secure environment
ENV NODE_ENV=production
ENV ZIRI_HOME=/app/.ziri

# Remove package manager
RUN rm -rf /usr/local/lib/node_modules/npm

WORKDIR /workspace
CMD ["ziri"]
```

### Secrets Management

```yaml
# docker-compose.secrets.yml
version: '3.8'

services:
  ziri:
    image: ziri/ziri:latest
    environment:
      - OPENAI_API_KEY_FILE=/run/secrets/openai_key
      - ZIRI_ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
    secrets:
      - openai_key
      - encryption_key

secrets:
  openai_key:
    external: true
  encryption_key:
    external: true
```

```bash
# Create secrets
echo "sk-your-openai-key" | docker secret create openai_key -
openssl rand -base64 32 | docker secret create encryption_key -
```

This Docker setup guide provides comprehensive coverage for containerized Ziri deployments across different environments and use cases.