import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { hasActivePlanFromClaims } from '@/lib/auth/plan'

// Páginas públicas que cualquiera puede ver sin sesión.
const isPublicPage = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)'])

// PDFs compartidos por WhatsApp: los abren clientes sin cuenta.
const isPublicApiRoute = createRouteMatcher(['/api/quotations/share(.*)'])

// Lista de espera: requiere sesión, pero NO requiere plan activo.
const isWaitlistRoute = createRouteMatcher(['/waitlist(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicApiRoute(req)) {
    return
  }

  const { userId, sessionClaims } = await auth()
  const hasPlan = hasActivePlanFromClaims(sessionClaims)

  // /waitlist: sólo para usuarios logueados sin plan.
  if (isWaitlistRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
    if (hasPlan) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
    return
  }

  // Páginas públicas: si ya hay sesión, mandamos a cada uno a su destino.
  if (isPublicPage(req)) {
    if (userId) {
      return NextResponse.redirect(
        new URL(hasPlan ? '/dashboard' : '/waitlist', req.url),
      )
    }
    return
  }

  // Todo el resto de la app (dashboard, cotizaciones, clientes, catálogo,
  // gastos, chat, ajustes, perfiles, onboarding, APIs internas...) requiere
  // sesión + plan activo.
  if (!userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  if (!hasPlan) {
    return NextResponse.redirect(new URL('/waitlist', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
