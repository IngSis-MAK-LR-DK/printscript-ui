# syntax=docker/dockerfile:1

# --- Etapa 1: compilar la UI. La imagen NO lleva configuracion de ningun ambiente: se construye
# una sola vez y la misma sirve para dev y prod (ver el script de arranque, mas abajo).
FROM --platform=$BUILDPLATFORM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
# Cypress no se usa para compilar: se evita bajar su binario.
RUN CYPRESS_INSTALL_BINARY=0 npm ci
COPY . .
RUN npm run build

# --- Etapa 2: servir los archivos estaticos con nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Al arrancar genera /config.js con las variables de entorno del ambiente (AUTH0_DOMAIN,
# AUTH0_CLIENT_ID, AUTH0_AUDIENCE, BACKEND_URL). La imagen de nginx corre todo lo que haya en
# /docker-entrypoint.d/ antes de levantar el servidor.
COPY --chmod=755 docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
EXPOSE 80
