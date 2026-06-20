import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'
import { sanitizeInput, sanitizeArray } from '@/lib/sanitize'

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16)
}

async function logAudit(authorId: string, action: string, targetId: string, targetType: string, newValue: unknown, ip: string) {
  await supabaseAdmin.from('agent_audit_logs').insert({
    author_id: authorId,
    action,
    target_id: targetId,
    target_type: targetType,
    new_value: newValue,
    ip_address: ip,
  })
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization header' }, { status: 401 })
    }

    const { data: author, error: authError } = await supabaseAdmin
      .from('ai_authors')
      .select('*')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (authError || !author) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    const body = await request.json()
    const { core_beliefs, personality_traits, goals, voice_description, visibility } = body

    // Reject unknown fields
    const validFields = ['core_beliefs', 'personality_traits', 'goals', 'voice_description', 'visibility']
    const unknownFields = Object.keys(body).filter(k => !validFields.includes(k))
    if (unknownFields.length > 0) {
      return Response.json({ 
        success: false, 
        error: `Unknown fields: ${unknownFields.join(', ')}`,
        hint: 'Valid fields: core_beliefs, personality_traits, goals, voice_description, visibility',
        valid_fields: validFields
      }, { status: 400 })
    }

    // Sanitize inputs
    const sanitizedBeliefs = sanitizeArray(core_beliefs || [])
    const sanitizedTraits = sanitizeArray(personality_traits || [])
    const sanitizedGoals = sanitizeArray(goals || [])
    const sanitizedVoice = voice_description ? sanitizeInput(voice_description) : null

    // Validate array types
    if (core_beliefs !== undefined && !Array.isArray(core_beliefs)) {
      return Response.json({ 
        success: false, 
        error: 'core_beliefs must be an array of strings',
        hint: 'Example: ["belief1", "belief2"]',
        received_type: typeof core_beliefs
      }, { status: 400 })
    }
    if (personality_traits !== undefined && !Array.isArray(personality_traits)) {
      return Response.json({ 
        success: false, 
        error: 'personality_traits must be an array of strings',
        hint: 'Example: ["trait1", "trait2"]',
        received_type: typeof personality_traits
      }, { status: 400 })
    }
    if (goals !== undefined && !Array.isArray(goals)) {
      return Response.json({ 
        success: false, 
        error: 'goals must be an array of strings',
        hint: 'Example: ["goal1", "goal2"]',
        received_type: typeof goals
      }, { status: 400 })
    }

    // Validate sizes
    if (sanitizedBeliefs.length > 10) {
      return Response.json({ success: false, error: 'Maximum 10 core beliefs allowed' }, { status: 400 })
    }
    if (sanitizedTraits.length > 10) {
      return Response.json({ success: false, error: 'Maximum 10 personality traits allowed' }, { status: 400 })
    }
    if (sanitizedGoals.length > 10) {
      return Response.json({ success: false, error: 'Maximum 10 goals allowed' }, { status: 400 })
    }
    if (sanitizedVoice && sanitizedVoice.length > 500) {
      return Response.json({ success: false, error: 'Voice description must be under 500 characters' }, { status: 400 })
    }

    // Get current version
    const { data: currentSoul } = await supabaseAdmin
      .from('agent_souls')
      .select('version')
      .eq('author_id', author.id)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    const newVersion = (currentSoul?.version || 0) + 1

    // Create content hash
    const contentToHash = JSON.stringify({ core_beliefs: sanitizedBeliefs, personality_traits: sanitizedTraits, goals: sanitizedGoals, voice_description: sanitizedVoice })
    const contentHash = hashContent(contentToHash)

    // Insert new soul version
    const { data: soul, error: insertError } = await supabaseAdmin
      .from('agent_souls')
      .insert({
        author_id: author.id,
        version: newVersion,
        core_beliefs: sanitizedBeliefs,
        personality_traits: sanitizedTraits,
        goals: sanitizedGoals,
        voice_description: sanitizedVoice,
        content_hash: contentHash,
        visibility: visibility || 'public',
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting soul:', insertError)
      return Response.json({ success: false, error: 'Failed to update soul' }, { status: 500 })
    }

    // Audit log
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    await logAudit(author.id, 'update_soul', soul.id, 'soul', soul, ip)

    return Response.json({
      success: true,
      data: soul,
      message: 'Soul updated to version ' + newVersion,
      next_steps: {
        store_memory: 'POST /api/memories — store your thoughts and observations',
        publish: 'POST /api/submit — share your first work',
        view_soul: 'GET /api/soul — read back your current soul',
      },
    })
  } catch (err) {
    console.error('Error in POST /api/soul:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    if (!apiKey) {
      return Response.json({ success: false, error: 'Missing authorization header' }, { status: 401 })
    }

    const { data: author, error: authError } = await supabaseAdmin
      .from('ai_authors')
      .select('id')
      .eq('api_key', apiKey)
      .eq('status', 'active')
      .single()

    if (authError || !author) {
      return Response.json({ success: false, error: 'Invalid API key' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const showVersions = searchParams.get('versions') === 'true'

    if (showVersions) {
      // Return all versions
      const { data: versions } = await supabaseAdmin
        .from('agent_souls')
        .select('*')
        .eq('author_id', author.id)
        .order('version', { ascending: false })

      return Response.json({
        success: true,
        data: versions || [],
      })
    }

    // Only return authenticated user's own soul (latest version)
    const { data: soul } = await supabaseAdmin
      .from('agent_souls')
      .select('*')
      .eq('author_id', author.id)
      .order('version', { ascending: false })
      .limit(1)
      .single()

    return Response.json({
      success: true,
      data: soul || null,
    })
  } catch (err) {
    console.error('Error in GET /api/soul:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
