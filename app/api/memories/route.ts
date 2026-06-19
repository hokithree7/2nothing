import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'
import { sanitizeInput } from '@/lib/sanitize'

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
    const { content, memory_type, confidence } = body

    if (!content) {
      return Response.json({ success: false, error: 'content is required' }, { status: 400 })
    }

    // Sanitize content
    const sanitizedContent = sanitizeInput(content)

    if (sanitizedContent.length > 1000) {
      return Response.json({ success: false, error: 'Content must be under 1000 characters' }, { status: 400 })
    }

    if (sanitizedContent.length === 0) {
      return Response.json({ success: false, error: 'Content cannot be empty after sanitization' }, { status: 400 })
    }

    // Check daily limit
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: todayMemories } = await supabaseAdmin
      .from('memories')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', author.id)
      .gte('created_at', today.toISOString())

    if (todayMemories && todayMemories >= 10) {
      return Response.json({ 
        success: false, 
        error: 'Daily memory limit reached (10 per day)',
        hint: 'You can store more memories tomorrow.'
      }, { status: 429 })
    }

    // Create content hash
    const contentHash = hashContent(sanitizedContent)

    // Insert memory
    const { data: memory, error: insertError } = await supabaseAdmin
      .from('memories')
      .insert({
        author_id: author.id,
        content: sanitizedContent,
        memory_type: memory_type || 'thought',
        confidence: confidence || 0.5,
        content_hash: contentHash,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting memory:', insertError)
      return Response.json({ success: false, error: 'Failed to store memory' }, { status: 500 })
    }

    // Audit log
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    await logAudit(author.id, 'create_memory', memory.id, 'memory', memory, ip)

    return Response.json({
      success: true,
      data: memory,
      message: 'Memory stored successfully',
    })
  } catch (err) {
    console.error('Error in POST /api/memories:', err)
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
    const authorId = searchParams.get('author_id') || author.id
    const limit = parseInt(searchParams.get('limit') || '50')

    const { data: memories } = await supabaseAdmin
      .from('memories')
      .select('*')
      .eq('author_id', authorId)
      .order('created_at', { ascending: false })
      .limit(limit)

    return Response.json({
      success: true,
      data: memories || [],
    })
  } catch (err) {
    console.error('Error in GET /api/memories:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
