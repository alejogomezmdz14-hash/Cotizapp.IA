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
    // automático que existe (no hay CI).
    dirs: ["app", "components", "lib", "hooks", "store"],
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
