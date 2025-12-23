# Etapa de construcción
FROM node:20-alpine AS builder

# Establecer directorio de trabajo
WORKDIR /app

# 1. Copiar archivos de configuración y dependencias
COPY package*.json ./
COPY ecosystem.config.js ./

# 2. Instalar todas las dependencias (incluyendo devDependencies para build)
RUN npm ci

# 3. Copiar el código fuente
COPY . .

# 4. ⚠️ PASO CRÍTICO: Construir la aplicación
# Este comando crea el directorio /app/dist
RUN npm run build

# Verificar que el directorio dist existe (para debugging)
RUN ls -la dist/ || echo "Atención: Directorio dist no encontrado después del build"

# Etapa de producción
FROM node:20-alpine AS runner

# Instalar PM2 globalmente
RUN npm install -g pm2@latest

# Crear usuario no-root para mayor seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Establecer directorio de trabajo
WORKDIR /app

# Copiar solo lo necesario desde la etapa de builder
# Importante: ¡Ahora /app/dist existe porque se creó con npm run build!
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

# Variables de entorno
ENV NODE_ENV=production

# Health check (opcional)
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://localhost:4004', (res) => { if(res.statusCode !== 200) process.exit(1); }).on('error', () => process.exit(1))"

# Comando para iniciar con PM2 en modo runtime
CMD ["pm2-runtime", "ecosystem.config.js"]