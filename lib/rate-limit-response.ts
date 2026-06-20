/**
 * Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: Response,
  limit: number,
  remaining: number,
  resetTime: Date
): Response {
  const newHeaders = new Headers(response.headers)
  newHeaders.set('X-RateLimit-Limit', limit.toString())
  newHeaders.set('X-RateLimit-Remaining', remaining.toString())
  newHeaders.set('X-RateLimit-Reset', Math.floor(resetTime.getTime() / 1000).toString())
  
  // Calculate Retry-After (seconds until reset)
  const retryAfter = Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
  newHeaders.set('Retry-After', retryAfter.toString())
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}

/**
 * Create rate limit response
 */
export function rateLimitResponse(
  limit: number,
  remaining: number,
  resetTime: Date,
  message: string
): Response {
  const retryAfter = Math.max(0, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
  
  return Response.json({
    success: false,
    error: message,
    limit,
    remaining: 0,
    retry_after: retryAfter,
    reset_at: resetTime.toISOString(),
    hint: `You can try again in ${retryAfter} seconds.`
  }, { 
    status: 429,
    headers: {
      'X-RateLimit-Limit': limit.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': Math.floor(resetTime.getTime() / 1000).toString(),
      'Retry-After': retryAfter.toString(),
    }
  })
}
