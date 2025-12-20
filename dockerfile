# ==================== ETAPA 1: BUILDER ====================
FROM node:22-alpine AS builder

# Dependencias necesarias
RUN apk add --no-cache python3 make g++ git curl

WORKDIR /app

# 1. Copiar archivos de dependencias
COPY package.json package-lock.json* ./

# 2. DEBUG: Ver versión de Node/npm
RUN echo "=== DEBUG: Node version ===" && \
    node --version && \
    echo "=== DEBUG: npm version ===" && \
    npm --version

# 3. Instalar dependencias con verbose
RUN npm ci --legacy-peer-deps --verbose 2>&1 | tail -100 || \
    (echo "=== npm ci failed, trying npm install ===" && \
     npm install --legacy-peer-deps --verbose 2>&1 | tail -100)

# 4. DEBUG: Ver Angular CLI version
RUN echo "=== DEBUG: Checking Angular CLI ===" && \
    npx ng version 2>&1 || echo "ng command not available"

# 5. Copiar todo el código
COPY . .

# 6. DEBUG: Ver estructura del proyecto
RUN echo "=== DEBUG: Project structure ===" && \
    ls -la && \
    echo "=== DEBUG: Angular config ===" && \
    cat angular.json 2>/dev/null | head -50 || echo "No angular.json"

# 7. DEBUG: Ver scripts en package.json
RUN echo "=== DEBUG: Build scripts ===" && \
    cat package.json | grep -A20 '"scripts"'

# 8. Build de Angular CON MÁS LOGGING
RUN echo "=== DEBUG: Starting Angular build ===" && \
    npm run build -- \
      --configuration=production \
      --output-path=dist \
      --output-hashing=all \
      --source-map=false \
      --verbose 2>&1 | tail -200

# ==================== ETAPA 2: PRODUCCIÓN ====================
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q -O- http://localhost:80 >/dev/null 2>&1 || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]