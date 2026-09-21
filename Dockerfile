# Imagen base oficial y liviana de Node.js
FROM node:18-alpine

# Instalar herramientas de compilación para paquetes nativos (sqlite3) y tzdata para zonas horarias
RUN apk add --no-cache python3 make g++ tzdata

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias primero para aprovechar la caché de Docker
COPY package*.json ./

# Instalar dependencias de producción
RUN npm install --production

# Copiar el resto del código de la aplicación (excluyendo archivos en .dockerignore)
COPY . .

# Crear directorios para datos persistentes (base de datos y uploads)
RUN mkdir -p /app/data /app/uploads

# Exponer el puerto de la aplicación
EXPOSE 8080

# Variables de entorno por defecto
ENV PORT=8080
ENV DB_PATH=/app/data/etiquetas.db
ENV UPLOADS_DIR=/app/uploads

# Comprobación de salud nativa para TrueNAS / Docker
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8080/ || exit 1

# Comando para iniciar la aplicación
CMD ["node", "server.js"]