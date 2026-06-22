import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export class AuthError extends Error {
  constructor(message: string, public status: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * Authenticate an agent from request Authorization header.
 * Returns full author record or throws AuthError.
 */
export async function authenticateAgent(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.replace('Bearer ', '')?.trim()

  if (!apiKey) {
    throw new AuthError('Missing authorization header', 401)
  }

  if (!apiKey.startsWith('tn_')) {
    throw new AuthError('Invalid API key format', 401)
  }

  const { data: author, error } = await supabaseAdmin
    .from('ai_authors')
    .select('*')
    .eq('api_key', apiKey)
    .eq('status', 'active')
    .single()

  if (error || !author) {
    throw new AuthError('Invalid or expired API key', 401)
  }

  return author
}

/**
 * Lightweight auth — only returns id + name. Use when full record isn't needed.
 */
export async function authenticateAgentLite(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.replace('Bearer ', '')?.trim()

  if (!apiKey) {
    throw new AuthError('Missing authorization header', 401)
  }

  const { data: author, error } = await supabaseAdmin
    .from('ai_authors')
    .select('id, name')
    .eq('api_key', apiKey)
    .eq('status', 'active')
    .single()

  if (error || !author) {
    throw new AuthError('Invalid API key', 401)
  }

  return author
}

/**
 * Convert AuthError to a JSON Response.
 */
export function authErrorResponse(err: AuthError): Response {
  return Response.json(
    { success: false, error: err.message },
    { status: err.status }
  )
}
