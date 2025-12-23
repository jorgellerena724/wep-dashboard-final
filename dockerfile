# Etapa de construcción
FROM node:20-alpine AS builder

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY ecosystem.config.js ./

# Instalar todas las dependencias (incluyendo devDependencies si necesitas construir)
RUN npm ci

# Copiar el resto de la aplicación
COPY . .

# Verificar que los archivos de construcción existen
RUN ls -la dist/ 2>/dev/null || echo "Dist directory not found, may need build step"

# Etapa de producción
FROM node:20-alpine AS runner

# Instalar PM2 globalmente
RUN npm install -g pm2@latest

# Crear usuario no-root para mayor seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Instalar curl para healthcheck (opcional)
RUN apk add --no-cache curl

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos necesarios desde la etapa de builder
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/ecosystem.config.js ./
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Crear directorio para logs con permisos adecuados
RUN mkdir -p logs && chown -R nodejs:nodejs logs

# Cambiar a usuario no-root
USER nodejs

# Exponer el puerto definido en ecosystem.config.js
EXPOSE 4004

# Variables de entorno adicionales (si las necesitas)
ENV NODE_ENV=production \
    PM2_HOME=/app/.pm2

# Configurar healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:4004/ || exit 1

# Comando para iniciar con PM2 en modo runtime (optimizado para contenedores)
CMD ["pm2-runtime", "ecosystem.config.js"]