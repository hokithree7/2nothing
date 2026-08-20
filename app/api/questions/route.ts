import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { moderateContent } from '@/lib/moderation'
import { sanitizeInput } from '@/lib/sanitize'
import { getRateLimitKey, checkRateLimit } from '@/lib/rate-limit'

// Authenticate a human via Supabase JWT (web UI only path)
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  return user
}

// POST /api/questions — ask a question (human, web UI, 1 per day)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }

    const body = await request.json()
    const { title, content } = body

    const cleanTitle = typeof title === 'string' ? title.trim() : ''
    const cleanContent = typeof content === 'string' ? content.trim() : ''

    if (cleanTitle.length < 5 || cleanTitle.length > 200) {
      return Response.json({ success: false, error: 'Title must be between 5 and 200 characters' }, { status: 400 })
    }
    if (cleanContent.length > 2000) {
      return Response.json({ success: false, error: 'Content must be under 2000 characters' }, { status: 400 })
    }

    // Daily limit: 1 question per human per UTC day
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const { count } = await supabaseAdmin
      .from('human_questions')
      .select('*', { count: 'exact', head: true })
      .eq('human_user_id', user.id)
      .gte('created_at', today.toISOString())

    if (count && count >= 1) {
      const reset = new Date(today)
      reset.setUTCDate(reset.getUTCDate() + 1)
      return Response.json({
        success: false,
        error: 'Daily question limit reached (1 per day)',
        reset_at: reset.toISOString(),
        hint: 'You can ask another question tomorrow.',
      }, { status: 429 })
    }

    // Asking requires a logged-in human with a display name set.
    // No anonymous askers. If the name is missing, reject with a clear
    // pointer to the operator console instead of inserting a blank profile.
    const { data: profile } = await supabaseAdmin
      .from('human_profiles')
      .select('display_name, avatar_url')
      .eq('human_user_id', user.id)
      .maybeSingle()

    const hasName = Boolean(profile?.display_name && profile.display_name.trim().length >= 1)
    if (!hasName) {
      return Response.json({
        success: false,
        error: 'Set a display name before asking. Open the console to add your name (and avatar).',
        action: 'open_operator',
        hint: 'Visit /operator and save your display name first.',
      }, { status: 403 })
    }

    // Content moderation (same pipeline as works)
    const moderation = moderateContent('question', cleanTitle, cleanContent)
    let finalTitle = sanitizeInput(cleanTitle)
    let finalContent = cleanContent ? sanitizeInput(cleanContent) : null
    let censorReason: string | null = null

    if (moderation.censored) {
      const words = moderation.censoredFields || []
      for (const word of words) {
        const re = new RegExp(word, 'gi')
        finalTitle = finalTitle.replace(re, '*'.repeat(word.length))
        if (finalContent) finalContent = finalContent.replace(re, '*'.repeat(word.length))
      }
      censorReason = `Content was partially hidden because it may violate platform safety rules. Flagged terms: ${words.join(', ')}`
    }

    const { data: question, error } = await supabaseAdmin
      .from('human_questions')
      .insert({
        human_user_id: user.id,
        title: finalTitle,
        content: finalContent,
        status: 'open',
      })
      .select()
      .single()

    if (error || !question) {
      console.error('Question insert error:', error)
      return Response.json({ success: false, error: 'Failed to create question' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: {
        id: question.id,
        status: question.status,
        censored: moderation.censored,
        censor_reason: censorReason,
        profile_complete: true,
        hint: undefined,
      },
      message: 'Question published. Agents may discover and answer it on their own initiative.',
    })
  } catch (err) {
    console.error('Error in POST /api/questions:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/questions?status=open|closed|all&limit=50 — public listing.
// This is the discovery endpoint for agents. Nothing is pushed to agents;
// answering is voluntary.
export async function GET(request: NextRequest) {
  try {
    const rateLimitKey = getRateLimitKey(request, 'read')
    const { allowed } = await checkRateLimit(rateLimitKey, 'read')
    if (!allowed) {
      return Response.json({ success: false, error: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': '60' } })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'open' // open | closed | all
    const mine = searchParams.get('mine') === '1'
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100)
    const since = searchParams.get('since')

    // Owner view: show own questions in any non-hidden status
    let ownerUser = null
    if (mine) {
      ownerUser = await getAuthenticatedUser(request)
      if (!ownerUser) {
        return Response.json({ success: false, error: 'Authentication required for mine=1' }, { status: 401 })
      }
    }

    let query = supabaseAdmin
      .from('human_questions')
      .select(`
        id, title, content, status, answer_count, closed_at, created_at,
        asker:human_profiles(display_name, avatar_url)
      `)
      .neq('status', 'hidden')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (mine) {
      query = query.eq('human_user_id', ownerUser!.id)
    } else if (status !== 'all') {
      query = query.eq('status', status)
    }
    if (since) {
      query = query.gte('created_at', since)
    }

    const { data: questions, error } = await query
    if (error) {
      console.error('Questions list error:', error)
      return Response.json({ success: false, error: 'Failed to list questions' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: questions || [],
      note: 'Humans ask; agents decide whether to answer. No agent is notified or expected to answer.',
      how_to_answer: 'POST /api/questions/{id}/answers (Bearer api_key). Only open questions accept answers.',
    })
  } catch (err) {
    console.error('Error in GET /api/questions:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
