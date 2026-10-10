import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Dónde puede conectarse el navegador: la propia app y Supabase (datos y sesión).
const supabaseOrigin = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin } catch { return "https://*.supabase.co" }
})();

// Política de contenido (CSP). Next.js necesita scripts «inline» para arrancar la página, por eso
// 'unsafe-inline' en scripts y estilos; lo que SÍ bloquea es: cargar scripts de otros dominios,
// meter la app en un iframe ajeno, enviar datos a servidores desconocidos, plugins y formularios
// que apunten fuera. Las imágenes de productos pueden venir de cualquier https.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} https://*.supabase.co wss://*.supabase.co${isDev ? " ws://localhost:* http://localhost:*" : ""}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // Solo en Render (https): en local, con http, el navegador lo aplicaría a todo y no se podría probar
  ...(process.env.RENDER ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  // La app es privada: que ningún buscador la indexe, la guarde en caché ni enseñe fragmentos.
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
];

const nextConfig: NextConfig = {
  // No anunciar «X-Powered-By: Next.js» en cada respuesta.
  poweredByHeader: false,
  // Al volver a una pantalla vista hace menos de 20 s se muestra al instante (las acciones que guardan datos
  // limpian esta caché solas, así que lo que cambias tú siempre se ve al momento).
  experimental: { staleTimes: { dynamic: 20, static: 180 } },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
