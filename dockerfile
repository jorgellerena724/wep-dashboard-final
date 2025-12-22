# ==================== ETAPA 1: BUILDER ======================
FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++ git
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY . .

RUN npm run build -- \
  --configuration=production \
  --output-hashing=all \
  --source-map=false

# VERIFICAR estructura generada
RUN echo "=== Estructura generada ===" && \
    find dist/ -type f -name "*.html" | head -10 && \
    echo "=== Contenido de dist/ ===" && \
    ls -la dist/ && \
    echo "=== Contenido de dist/browser/ ===" && \
    ls -la dist/browser/ | head -20

# ==================== ETAPA 2: PRODUCCIÓN ====================
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

# ✅ CORREGIDO: La ruta correcta es /app/dist/browser
COPY --from=builder /app/dist/browser /usr/share/nginx/html

# Verificar copia
RUN echo "=== Archivos copiados ===" && \
    ls -la /usr/share/nginx/html/ && \
    if [ -f "/usr/share/nginx/html/index.html" ]; then \
        echo "✅ index.html existe"; \
    else \
        echo "❌ index.html NO existe"; \
        exit 1; \
    fi

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Verificar configuración de nginx
RUN nginx -t

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:80 || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]