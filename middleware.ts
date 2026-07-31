import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { decideAccess } from '@/lib/auth/access'

// Páginas públicas que cualquiera puede ver sin sesión.
const isPublicPage = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)'])

// PDFs compartidos por WhatsApp (los abren clientes sin cuenta) y el health
// check del cron keep-alive (sin sesión).
const isPublicApiRoute = createRouteMatcher([
  '/api/quotations/share(.*)',
  '/api/health',
])

// Lista de espera: la ve quien inició sesión pero todavía no fue autorizado por
// el dueño. Se controla con ACCESS_GATE_ENABLED y publicMetadata.access en Clerk.
const isWaitlistRoute = createRouteMatcher(['/waitlist(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Dominio canónico. En producción, cualquier host que no sea cotizapp.lat
  // (típicamente el *.vercel.app interno) redirige ahí. Si no, el login sale en
  // pantalla negra: Clerk (instancia de producción) está atado a cotizapp.lat y
  // no inicializa en otro dominio. El cron pega a /api/health y no debe redirigir.
  if (process.env.VERCEL_ENV === 'production') {
    const host = req.headers.get('host')
    if (
      host &&
      host !== 'cotizapp.lat' &&
      req.nextUrl.pathname !== '/api/health'
    ) {
      const url = req.nextUrl.clone()
      url.protocol = 'https:'
      url.hostname = 'cotizapp.lat'
      url.port = ''
      return NextResponse.redirect(url, 308)
    }
  }

  if (isPublicApiRoute(req)) {
    return
  }

  const { userId, sessionClaims } = await auth()

  const gateEnabled = process.env.ACCESS_GATE_ENABLED === '1'
  const access = decideAccess(sessionClaims, gateEnabled)

  if (access.reason === 'claims-unavailable') {
    // El session token de Clerk no está exponiendo publicMetadata. El gate no
    // puede funcionar así, y bloquear dejaría afuera a todos. Se deja pasar y se
    // avisa fuerte: hay que agregar { "metadata": "{{user.public_metadata}}" } en
    // Clerk Dashboard → Sessions → Customize session token.
    console.error('[acceso] ACCESS_GATE_ENABLED=1 pero los sessionClaims no traen publicMetadata; el gate quedó inactivo')
  }

  // La lista de espera es la única página que ve quien todavía no fue autorizado.
  if (isWaitlistRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
    if (access.allowed) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return
  }

  // Páginas públicas: si ya hay sesión, mandamos al dashboard.
  if (isPublicPage(req)) {
    if (userId) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return
  }

  // Todo el resto de la app (dashboard, cotizaciones, clientes, catálogo,
  // gastos, chat, ajustes, perfiles, onboarding, APIs internas...) requiere
  // sesión. El cupo del trial se controla por acción (crear cotización /
  // escanear factura), no bloquea el acceso a la app.
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  if (!access.allowed) {
    return NextResponse.redirect(new URL('/waitlist', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
