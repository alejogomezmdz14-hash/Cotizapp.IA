/** @type {import('next').NextConfig} */

// Headers de seguridad seguros (no afectan funcionalidad). CSP y
// Permissions-Policy se dejan para una pasada con testing en runtime: la app
// usa micrófono (entrada por voz) y depende de Clerk/Supabase/OpenAI, así que
// una política mal calibrada rompería features en producción.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig = {
  eslint: {
    // next lint / next build por defecto solo barren app, pages, components,
    // lib, src. Este repo tiene además hooks/ y store/ con código real: sin
    // esto, un import prohibido ahi pasa invisible por el único gate
    // automático que existe (no hay CI). `scripts/` se suma por lo mismo
    // (ahí vive el script de migración de credenciales fiscales, que también
    // puede importar cosas prohibidas). `tests/` se probó y se dejó afuera a
    // propósito: sumarla saca un error preexistente y no relacionado
    // (`tests/invoice-scan-persistence.test.ts:103`, regla
    // `@next/next/no-assign-module-variable` sobre `const module = ...`) que
    // no es parte de este trabajo — no se corrige acá.
    dirs: ["app", "components", "lib", "hooks", "store", "scripts"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
