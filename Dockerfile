# Imagen base oficial y liviana de Node.js
FROM node:18-alpine

# Instalar herramientas necesarias para compilar paquetes nativos como sqlite3 en Alpine
RUN apk add --no-cache python3 make g++

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de dependencias primero para aprovechar la caché de Docker
COPY package*.json ./

# Instalar dependencias del proyecto
RUN npm install --production

# Copiar el resto del código de la aplicación
COPY . .

# Crear directorios para datos persistentes (base de datos y uploads)
RUN mkdir -p /app/data /app/uploads

# Exponer el puerto configurado en server.js
EXPOSE 8080

# Variables de entorno para el contenedor
ENV PORT=8080
ENV DB_PATH=/app/data/etiquetas.db
ENV UPLOADS_DIR=/app/uploads

# Comando para iniciar la aplicación
CMD ["node", "server.js"]