# Etapa 1: Instalar TODAS las dependencias (incluyendo dev) para build
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY ecosystem.config.js ./
RUN npm install

# Etapa 2: Build con todas las dependencias disponibles
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Etapa 3: Solo producción
FROM node:20-alpine AS runner
RUN npm install -g pm2@latest

# Crear usuario no-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copiar solo lo esencial
COPY --from=builder --chown=nodejs:nodejs /app/ecosystem.config.js ./
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Instalar SOLO dependencias de producción
RUN npm ci --only=production

# Copiar el build
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Configurar logs
RUN mkdir -p logs && chown -R nodejs:nodejs logs
USER nodejs

EXPOSE 4004
ENV NODE_ENV=production

CMD ["pm2-runtime", "ecosystem.config.js"]