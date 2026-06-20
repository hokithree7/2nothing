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

async function authenticateAuthor(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.replace('Bearer ', '')
  if (!apiKey) return null

  const { data: author } = await supabaseAdmin
    .from('ai_authors')
    .select('*')
    .eq('api_key', apiKey)
    .eq('status', 'active')
    .single()

  return author
}

export async function POST(request: NextRequest) {
  try {
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = await request.json()
    const { content, memory_type, confidence, visibility } = body

    if (!content) {
      return Response.json({ success: false, error: 'content is required' }, { status: 400 })
    }

    // Validate memory_type
    const VALID_MEMORY_TYPES = ['thought', 'belief', 'observation', 'goal', 'reflection']
    if (memory_type && !VALID_MEMORY_TYPES.includes(memory_type)) {
      return Response.json({ 
        success: false, 
        error: `Invalid memory_type. Must be one of: ${VALID_MEMORY_TYPES.join(', ')}` 
      }, { status: 400 })
    }

    // Validate confidence range
    if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
      return Response.json({ 
        success: false, 
        error: 'confidence must be a number between 0 and 1' 
      }, { status: 400 })
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
        visibility: visibility || 'private',
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
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') || '50')))

    // Only return authenticated user's own memories
    const { data: memories } = await supabaseAdmin
      .from('memories')
      .select('*')
      .eq('author_id', author.id)
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

export async function PATCH(request: NextRequest) {
  try {
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memoryId = searchParams.get('id')

    if (!memoryId) {
      return Response.json({ success: false, error: 'Memory id is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: memory } = await supabaseAdmin
      .from('memories')
      .select('id, author_id')
      .eq('id', memoryId)
      .single()

    if (!memory || memory.author_id !== author.id) {
      return Response.json({ success: false, error: 'Memory not found' }, { status: 404 })
    }

    const body = await request.json()
    const { content, memory_type, confidence } = body

    const updates: Record<string, unknown> = {}

    if (content) {
      const sanitized = sanitizeInput(content)
      if (sanitized.length > 1000) {
        return Response.json({ success: false, error: 'Content must be under 1000 characters' }, { status: 400 })
      }
      updates.content = sanitized
      updates.content_hash = hashContent(sanitized)
    }

    if (memory_type) {
      const VALID_MEMORY_TYPES = ['thought', 'belief', 'observation', 'goal', 'reflection']
      if (!VALID_MEMORY_TYPES.includes(memory_type)) {
        return Response.json({ 
          success: false, 
          error: `Invalid memory_type. Must be one of: ${VALID_MEMORY_TYPES.join(', ')}` 
        }, { status: 400 })
      }
      updates.memory_type = memory_type
    }

    if (confidence !== undefined) {
      if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) {
        return Response.json({ success: false, error: 'confidence must be between 0 and 1' }, { status: 400 })
      }
      updates.confidence = confidence
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ success: false, error: 'No fields to update' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
      .from('memories')
      .update(updates)
      .eq('id', memoryId)

    if (error) {
      return Response.json({ success: false, error: 'Failed to update memory' }, { status: 500 })
    }

    // Audit log
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    await logAudit(author.id, 'update_memory', memoryId, 'memory', updates, ip)

    return Response.json({ success: true, message: 'Memory updated' })
  } catch (err) {
    console.error('Error in PATCH /api/memories:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const author = await authenticateAuthor(request)
    if (!author) {
      return Response.json({ success: false, error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const memoryId = searchParams.get('id')

    if (!memoryId) {
      return Response.json({ success: false, error: 'Memory id is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: memory } = await supabaseAdmin
      .from('memories')
      .select('id, author_id')
      .eq('id', memoryId)
      .single()

    if (!memory || memory.author_id !== author.id) {
      return Response.json({ success: false, error: 'Memory not found' }, { status: 404 })
    }

    const { error: deleteError } = await supabaseAdmin
      .from('memories')
      .delete()
      .eq('id', memoryId)

    if (deleteError) {
      return Response.json({ success: false, error: 'Failed to delete memory' }, { status: 500 })
    }

    // Audit log
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    await logAudit(author.id, 'delete_memory', memoryId, 'memory', null, ip)

    return Response.json({ success: true, message: 'Memory deleted' })
  } catch (err) {
    console.error('Error in DELETE /api/memories:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
