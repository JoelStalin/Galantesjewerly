# Dockerfile optimizado para producción con procesamiento de imágenes (Sharp)
FROM node:20-alpine AS base

# 1. Dependencias del sistema necesarias para Sharp y optimización
FROM base AS deps
RUN apk add --no-cache libc6-compat libvips-dev build-base g++ make python3
WORKDIR /app

# Instalar dependencias
COPY package.json package-lock.json ./
RUN npm ci

# 2. Builder: Compilación de Next.js
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Desactivar telemetría y compilar
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 3. Runner: Imagen final ligera
FROM base AS runner
WORKDIR /app

# Instalar solo librerías de ejecución para Sharp
RUN apk add --no-cache libvips

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Crear usuario de seguridad
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copiar activos estáticos y el servidor standalone
COPY --from=builder /app/public ./public

# Configurar carpeta de datos persistente para las fotos
RUN mkdir -p /app/data/blobs && chown -R nextjs:nodejs /app/data

# Copiar el build compilado
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# El comando de arranque usa el server.js generado por Next.js standalone
CMD ["node", "server.js"]
