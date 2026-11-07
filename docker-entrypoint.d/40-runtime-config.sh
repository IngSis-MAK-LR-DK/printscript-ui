#!/bin/sh
# Genera /config.js con la configuracion del ambiente al arrancar el contenedor. La imagen de nginx
# corre todo lo que haya en /docker-entrypoint.d/ antes de levantar el servidor.
#
# Asi la MISMA imagen sirve para dev y prod: lo unico que cambia son las variables de entorno.
# Ninguna es un secreto (terminan en el JavaScript que baja el navegador).
#
# Si falta alguna, el contenedor no arranca: es mejor eso que servir una UI con el login roto.
set -eu

: "${AUTH0_DOMAIN:?Falta AUTH0_DOMAIN (dominio del tenant, sin https://)}"
: "${AUTH0_CLIENT_ID:?Falta AUTH0_CLIENT_ID (Client ID de la application SPA)}"
: "${AUTH0_AUDIENCE:?Falta AUTH0_AUDIENCE (Identifier de la API snippet-searcher)}"
: "${BACKEND_URL:?Falta BACKEND_URL (URL publica del handler, sin barra final)}"

CONFIG_DIR="${CONFIG_DIR:-/usr/share/nginx/html}"

# Escapa \ y " para que el valor entre bien en un string de JavaScript.
esc() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

cat > "${CONFIG_DIR}/config.js" <<EOF
window.__APP_CONFIG__ = {
  auth0Domain: "$(esc "$AUTH0_DOMAIN")",
  auth0ClientId: "$(esc "$AUTH0_CLIENT_ID")",
  auth0Audience: "$(esc "$AUTH0_AUDIENCE")",
  backendUrl: "$(esc "$BACKEND_URL")"
};
EOF

echo "40-runtime-config: config.js generado en ${CONFIG_DIR}"
