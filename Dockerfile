# syntax=docker/dockerfile:1

# --- Etapa 1: compilar la UI. Vite deja las variables VITE_* fijas en el JS, por eso entran al
# construir y cada ambiente (dev, prod) necesita su propia imagen. Ninguna es un secreto.
FROM --platform=$BUILDPLATFORM node:20-alpine AS build
WORKDIR /app
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_BACKEND_URL
COPY package.json package-lock.json .npmrc ./
# Cypress no se usa para compilar: se evita bajar su binario.
RUN CYPRESS_INSTALL_BINARY=0 npm ci
COPY . .
RUN npm run build

# --- Etapa 2: servir los archivos estaticos con nginx
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
