# Dockerfile corregido
FROM node:20-alpine AS builder

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY ecosystem.config.js ./

# Sincronizar package-lock.json si es necesario
RUN npm install --package-lock-only --no-audit --progress=false || npm install

# Instalar dependencias
RUN npm ci --only=production

# Copiar el resto de la aplicación
COPY . .

# Etapa de producción
FROM node:20-alpine AS runner

# Instalar PM2 globalmente
RUN npm install -g pm2@latest

# Crear usuario no-root para mayor seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

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

# Exponer el puerto
EXPOSE 4004

# Variables de entorno
ENV NODE_ENV=production

# Comando para iniciar con PM2
CMD ["pm2-runtime", "ecosystem.config.js"]