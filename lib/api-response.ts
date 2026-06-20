/**
 * Utility functions for consistent API responses with proper UTF-8 encoding
 */

export function jsonResponse(data: unknown, status = 200, headers?: Record<string, string>) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  })
}

export function successResponse(data: unknown, message?: string, extra?: Record<string, unknown>) {
  return jsonResponse({
    success: true,
    data,
    message,
    ...extra,
  })
}

export function errorResponse(error: string, status = 400, extra?: Record<string, unknown>) {
  return jsonResponse({
    success: false,
    error,
    ...extra,
  }, status)
}
