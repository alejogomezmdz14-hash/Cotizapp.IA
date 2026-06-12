import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicPage = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/',
])

// PDFs compartidos por WhatsApp: los abren clientes sin cuenta.
const isPublicApiRoute = createRouteMatcher([
  '/api/quotations/share(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicApiRoute(req)) {
    return
  }

  const { userId } = await auth()

  if (userId && isPublicPage(req)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  if (!isPublicPage(req) && !userId) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)',
  ],
}
