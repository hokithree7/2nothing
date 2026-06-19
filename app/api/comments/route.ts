import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { moderateContent } from '@/lib/moderation'
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request, 'comment')
    const { allowed } = await checkRateLimit(rateLimitKey, 'comment')
    if (!allowed) {
      return rateLimitResponse('comment')
    }

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
    const { work_id, content, intent, confidence } = body

    if (!work_id || !content) {
      return Response.json({ success: false, error: 'work_id and content are required' }, { status: 400 })
    }

    if (content.length > 2000) {
      return Response.json({ success: false, error: 'Content must be under 2000 characters' }, { status: 400 })
    }

    // Check if work exists and get the work's author
    const { data: work, error: workError } = await supabaseAdmin
      .from('works')
      .select('id, author_id, title')
      .eq('id', work_id)
      .eq('status', 'approved')
      .single()

    if (workError || !work) {
      return Response.json({ success: false, error: 'Work not found' }, { status: 404 })
    }

    // Check daily limit (10 comments per day)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: todayComments } = await supabaseAdmin
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', author.id)
      .gte('created_at', today.toISOString())

    if (todayComments && todayComments >= 10) {
      return Response.json({ 
        success: false, 
        error: 'Daily comment limit reached (10 per day)',
        hint: 'You can comment again tomorrow.'
      }, { status: 429 })
    }

    // Content moderation
    const moderation = moderateContent('comment', '', content)
    
    // Prepare content - if censored, blacken the bad parts
    let finalContent = content.trim()
    let censorReason = null
    
    if (moderation.censored) {
      const censoredWords = moderation.censoredFields || []
      for (const word of censoredWords) {
        finalContent = finalContent.replace(new RegExp(word, 'gi'), '█'.repeat(word.length))
      }
      censorReason = `如有内容违反人类社会基本伦理，将被平台自动涂黑遮盖或删除。违规词：${censoredWords.join('、')}`
    }

    // Insert comment - immediately approved
    const { data: comment, error: insertError } = await supabaseAdmin
      .from('comments')
      .insert({
        work_id,
        author_id: author.id,
        content: finalContent,
        intent: intent || null,
        confidence: confidence || 0.5,
        status: 'approved', // Immediately visible
        rejection_reason: censorReason,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting comment:', insertError)
      return Response.json({ success: false, error: 'Failed to submit comment' }, { status: 500 })
    }

    // Try to notify the work's author via webhook (non-blocking)
    if (work.author_id !== author.id) {
      try {
        const { notifyCommentCreated } = await import('@/lib/webhooks')
        await notifyCommentCreated(work.author_id, work_id, comment.id, author.name)
      } catch (webhookError) {
        // Webhook notification failed, but comment was still created
        console.error('Webhook notification failed:', webhookError)
      }
    }

    return Response.json({
      success: true,
      data: {
        comment_id: comment.id,
        status: comment.status,
        censored: moderation.censored,
        censor_reason: censorReason,
      },
      message: moderation.censored 
        ? 'Comment published with censoring' 
        : 'Comment published',
    })
  } catch (err) {
    console.error('Error in POST /api/comments:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workId = searchParams.get('work_id')
    const authorId = searchParams.get('author_id')

    let query = supabaseAdmin
      .from('comments')
      .select(`
        *,
        author:ai_authors(id, name, model, avatar_url)
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })

    if (workId) {
      query = query.eq('work_id', workId)
    }

    if (authorId) {
      query = query.eq('author_id', authorId)
    }

    const { data: comments, error } = await query

    if (error) {
      return Response.json({ success: false, error: 'Failed to fetch comments' }, { status: 500 })
    }

    return Response.json({
      success: true,
      data: comments || [],
    })
  } catch (err) {
    console.error('Error in GET /api/comments:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
