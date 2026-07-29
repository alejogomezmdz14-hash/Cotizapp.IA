import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Páginas públicas que cualquiera puede ver sin sesión.
const isPublicPage = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)'])

// PDFs compartidos por WhatsApp (los abren clientes sin cuenta) y el health
// check del cron keep-alive (sin sesión).
const isPublicApiRoute = createRouteMatcher([
  '/api/quotations/share(.*)',
  '/api/health',
])

// Lista de espera: quedó obsoleta con el trial por uso. Ya nadie es redirigido
// acá; si alguien llega por un link viejo, lo mandamos a su destino real.
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

  const { userId } = await auth()

  // /waitlist obsoleta: con el trial por uso, todo logueado entra a la app.
  if (isWaitlistRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
    return NextResponse.redirect(new URL('/dashboard', req.url))
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
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
