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

# Crear la carpeta uploads por si no existe
RUN mkdir -p /app/uploads

# Exponer el puerto configurado en server.js
EXPOSE 8080

# Variable de entorno para el puerto
ENV PORT=8080

# Comando para iniciar la aplicación
CMD ["node", "server.js"]