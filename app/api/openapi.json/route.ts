import { NextRequest, NextResponse } from 'next/server'

// Preserve the documented machine-readable specification under the legacy API path.
export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/.well-known/openapi.json', request.url), 307)
}
