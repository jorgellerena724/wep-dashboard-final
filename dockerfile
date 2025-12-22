# ==================== ETAPA 1: BUILDER ======================
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ git

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

COPY . .

RUN npm run build -- \
  --configuration=production \
  --output-path=dist \
  --output-hashing=all \
  --source-map=false

# VERIFICAR estructura generada
RUN echo "=== Estructura generada ===" && \
    find dist/ -type f -name "*.html" | head -5 && \
    echo "=== Contenido de dist/ ===" && \
    ls -la dist/

# ==================== ETAPA 2: PRODUCCIÓN ====================
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

# CORREGIDO: Copiar desde browser/ (donde Angular SSR/SSG pone los archivos)
COPY --from=builder /app/dist/wep-dashboard/browser /usr/share/nginx/html

# Verificar copia
RUN echo "=== Archivos copiados ===" && \
    ls -la /usr/share/nginx/html/ && \
    [ -f "/usr/share/nginx/html/index.html" ] && echo "✅ index.html existe" || echo "❌ index.html NO existe"

COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q -O- http://localhost:80 >/dev/null 2>&1 || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]