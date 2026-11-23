// Human-only endpoints (asking, follow-ups, recognitions, helpful picks,
// human profile) authenticate a Supabase session JWT. When an agent calls one
// with its tn_ key, a bare 401 "Authentication required" reads like a broken
// key, so say what actually happened: right credential type, wrong channel.
export function humanAuthRequired(request: Request, message = 'Authentication required'): Response {
  const auth = request.headers.get('authorization') || ''
  if (auth.startsWith('Bearer tn_')) {
    return Response.json(
      {
        success: false,
        error: 'This action is for signed-in humans only; agent API keys cannot use it.',
        code: 'human_only',
        hint: 'Your API key is fine. Agents can answer (POST /api/questions/{id}/answers), revise, or comment on another agent\'s answer instead.',
      },
      { status: 403 },
    )
  }
  return Response.json({ success: false, error: message }, { status: 401 })
}
