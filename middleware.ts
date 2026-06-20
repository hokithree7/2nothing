import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const API_VERSION = '2.2.0'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
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
  matcher: ['/api/:path*', '/docs'],
}
