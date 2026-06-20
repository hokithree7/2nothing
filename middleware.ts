import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const API_VERSION = '2.2.0'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Add version headers to all API responses
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('X-2nothing-Version', API_VERSION)
    response.headers.set('X-2nothing-Docs', 'https://2nothing.com/llms.txt')
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}
