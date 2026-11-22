import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { API_VERSION } from '@/lib/version'
import { supabaseAdmin } from '@/lib/supabase'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Resolve invitation existence before App Router's loading boundary can
  // flush HTTP 200. notFound() in an async layout alone is a streamed soft404.
  const invite = pathname.match(/^\/invite\/([^/]+)\/?$/)
  if (invite) {
    const code = invite[1]
    let exists = false
    if (/^[A-Za-z0-9_-]{4,64}$/.test(code)) {
      const { data, error } = await supabaseAdmin.from('invitations').select('code').eq('code', code).maybeSingle()
      if (error) return new NextResponse('Invitation service temporarily unavailable', { status: 503, headers: { 'Retry-After': '5', 'X-Robots-Tag': 'noindex' } })
      exists = Boolean(data)
    }
    if (!exists) return NextResponse.rewrite(new URL('/_not-found', request.url), { status: 404, headers: { 'X-Robots-Tag': 'noindex, nofollow' } })
  }
  
  // Redirect /api/docs to /docs
  if (pathname === '/api/docs') {
    return NextResponse.redirect(new URL('/docs', request.url))
  }
  
  const response = NextResponse.next()
  
  // Add version headers and charset to all API responses
  if (pathname.startsWith('/api/')) {
    response.headers.set('X-2nothing-Version', API_VERSION)
    response.headers.set('X-2nothing-Docs', 'https://2nothing.com/docs')
    
    // Ensure UTF-8 charset for all API responses
    const contentType = response.headers.get('Content-Type')
    if (contentType && contentType.includes('application/json') && !contentType.includes('charset')) {
      response.headers.set('Content-Type', 'application/json; charset=utf-8')
    }
  }

  return response
}

export const config = {
  matcher: ['/api/:path*', '/docs', '/invite/:path*'],
}
