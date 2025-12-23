# ==================== ETAPA 1: BUILDER ========================
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copiar archivos de dependencias
COPY package.json package-lock.json ./

# 2. Instalar dependencias
RUN npm ci --legacy-peer-deps --no-audit --prefer-offline

# 3. Copiar todo el código fuente
COPY . .

# 4. Build de Angular con SSR
RUN npm run build:ssr

# 5. Verificar estructura generada
RUN echo "✅ Build completado" && \
    ls -la dist/wep-dashboard/ && \
    echo "📄 Server file exists:" && \
    [ -f dist/wep-dashboard/server/server.mjs ] && echo "✅ SI" || echo "❌ NO"

# ==================== ETAPA 2: PRODUCCIÓN ====================
FROM node:20-alpine

# 1. Instalar PM2
RUN npm install -g pm2

WORKDIR /app

# 2. Copiar desde builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

# 3. Instalar solo dependencias de producción
RUN npm ci --omit=dev --no-audit --prefer-offline

# 4. Copiar configuración de PM2
COPY ecosystem.config.js ./

# 5. Crear directorio de logs
RUN mkdir -p logs && chmod 755 logs

# 6. Exponer puerto 4004 
EXPOSE 4004

# 7. Health check con puerto 4004
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q -O- http://localhost:4004/health >/dev/null 2>&1 || exit 1

# 8. Iniciar con PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]