// Configuracion en runtime (ver src/config.ts). Con `npm run dev` queda vacia y la UI usa las
// variables VITE_* del .env. En la imagen Docker la reemplaza docker-entrypoint.d/40-runtime-config.sh.
window.__APP_CONFIG__ = {};
