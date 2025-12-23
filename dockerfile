# Etapa de build
FROM node:20-alpine AS builder

WORKDIR /app

# 1. Copiar archivos de dependencias
COPY package*.json ./
COPY ecosystem.config.js ./

# 2. Instalar dependencias
RUN npm install

# 3. Copiar todo
COPY . .

# 4. Build de Angular (¡esto funciona bien!)
RUN npm run build

# Etapa de producción
FROM node:20-alpine

# Instalar PM2
RUN npm install -g pm2@latest

WORKDIR /app

# Copiar solo lo esencial
COPY --from=builder /app/ecosystem.config.js ./
COPY --from=builder /app/package*.json ./

# Instalar SOLO dependencias de producción (sin problemas de sincronización)
RUN npm install --production --no-audit

# Copiar el build de Angular
COPY --from=builder /app/dist ./dist

# Logs
RUN mkdir -p logs

EXPOSE 4004
ENV NODE_ENV=production

CMD ["pm2-runtime", "ecosystem.config.js"]