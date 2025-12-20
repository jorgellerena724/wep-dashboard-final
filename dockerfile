# ==================== ETAPA 1: BUILDER ====================
# USAR NODE 20 o 22 (Angular CLI lo requiere)
FROM node:20-alpine AS builder

# Dependencias necesarias para build de Angular
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copiar archivos de dependencias (mejor cache)
COPY package.json package-lock.json* ./

# Instalar dependencias
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copiar todo el código fuente
COPY . .

# Build de Angular
# NOTA: environment.prod.ts ya tiene las URLs correctas
RUN npm run build -- \
  --configuration=production \
  --output-path=dist \
  --output-hashing=all \
  --source-map=false

# ==================== ETAPA 2: PRODUCCIÓN ====================
FROM nginx:alpine

# Metadatos
LABEL org.opencontainers.image.title="WEP Admin Panel"
LABEL org.opencontainers.image.description="Panel de administración Angular para WEP"

# Eliminar contenido por defecto
RUN rm -rf /usr/share/nginx/html/*

# Copiar archivos construidos de Angular
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar configuración Nginx optimizada
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q -O- http://localhost:80 >/dev/null 2>&1 || exit 1

# Exponer puerto HTTP
EXPOSE 80

# Comando por defecto
CMD ["nginx", "-g", "daemon off;"]