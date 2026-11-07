/**
 * Configuracion de la UI, leida en RUNTIME.
 *
 * Una misma imagen Docker sirve para todos los ambientes (dev, prod): al arrancar el contenedor se
 * genera /config.js con las variables de entorno del ambiente (ver docker-entrypoint.d/). Ese
 * archivo define window.__APP_CONFIG__ antes de que cargue la app.
 *
 * Con `npm run dev` no hay contenedor: /config.js (public/config.js) viene vacio y los valores salen
 * de las variables VITE_* del .env, como siempre.
 */
interface AppConfig {
    auth0Domain?: string;
    auth0ClientId?: string;
    auth0Audience?: string;
    backendUrl?: string;
}

declare global {
    interface Window {
        __APP_CONFIG__?: AppConfig;
    }
}

const runtime: AppConfig = window.__APP_CONFIG__ ?? {};

/** Un valor vacio cuenta como ausente: asi un config.js vacio cae a las variables VITE_*. */
const pick = (runtimeValue: string | undefined, buildValue: string | undefined): string | undefined =>
    runtimeValue || buildValue || undefined;

export const config = {
    auth0Domain: pick(runtime.auth0Domain, import.meta.env.VITE_AUTH0_DOMAIN) ?? "",
    auth0ClientId: pick(runtime.auth0ClientId, import.meta.env.VITE_AUTH0_CLIENT_ID) ?? "",
    auth0Audience: pick(runtime.auth0Audience, import.meta.env.VITE_AUTH0_AUDIENCE),
    /** Base URL de snippet-handler, ej. http://localhost:8080 (sin barra final). */
    backendUrl: pick(runtime.backendUrl, import.meta.env.VITE_BACKEND_URL) ?? "http://localhost:8080",
};
