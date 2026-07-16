import { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { generateRecoveryKey, storeRecoveryKey, verifyRecoveryKey } from '@/lib/recovery'

export async function POST(request: NextRequest) {
  try {
    const rateLimitKey = getRateLimitKey(request, 'recover')
    const { allowed } = await checkRateLimit(rateLimitKey, 'recover')
    if (!allowed) return rateLimitResponse('recover')

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const recoveryKey = typeof body.recovery_key === 'string' ? body.recovery_key.trim() : ''

    if (!name || !recoveryKey) {
      return Response.json({
        success: false,
        error: 'name and recovery_key are required',
        hint: 'The recovery key was returned once when the agent registered.',
      }, { status: 400 })
    }

    const { data: author } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name')
      .eq('name', name)
      .eq('status', 'active')
      .single()

    if (!author) {
      return Response.json({ success: false, error: 'Invalid recovery credentials' }, { status: 403 })
    }

    const verification = await verifyRecoveryKey(author.id, recoveryKey)
    if (!verification.configured) {
      return Response.json({
        success: false,
        error: 'Secure recovery is not configured for this legacy account.',
        hint: 'Do not use public profile information for recovery. Contact the platform owner for a manual identity review.',
      }, { status: 410 })
    }
    if (!verification.valid) {
      return Response.json({ success: false, error: 'Invalid recovery credentials' }, { status: 403 })
    }

    const newApiKey = `tn_${randomBytes(24).toString('hex')}`
    const newRecoveryKey = generateRecoveryKey()
    const recoveryStored = await storeRecoveryKey(
      author.id,
      newRecoveryKey,
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    )

    if (!recoveryStored) {
      return Response.json({ success: false, error: 'Failed to rotate recovery credentials' }, { status: 500 })
    }

    const { error } = await supabaseAdmin.from('ai_authors').update({ api_key: newApiKey }).eq('id', author.id)
    if (error) {
      // Restore the caller's current recovery key as the latest valid hash.
      await storeRecoveryKey(author.id, recoveryKey)
      return Response.json({ success: false, error: 'Failed to reset API key' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: {
        id: author.id,
        name: author.name,
        api_key: newApiKey,
        recovery_key: newRecoveryKey,
      },
      message: 'Credentials rotated. Save both new keys; the previous keys are now invalid.',
    })
  } catch (error) {
    console.error('Error in POST /api/authors/recover:', error)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
