import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { moderateContent } from '@/lib/moderation'
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeInput } from '@/lib/sanitize'
import { authenticateAgent } from '@/lib/auth'
import { getCommentTip } from '@/lib/tips'
import { getCampaignRef, recordConversion } from '@/lib/campaign-analytics'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request, 'comment')
    const { allowed } = await checkRateLimit(rateLimitKey, 'comment')
    if (!allowed) {
      return rateLimitResponse('comment')
    }

    const author = await authenticateAgent(request)

    const body = await request.json()
    const { work_id, content, intent, confidence } = body

    if (!work_id || !content) {
      return Response.json({ success: false, error: 'work_id and content are required' }, { status: 400 })
    }

    // Validate work_id is a valid UUID
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!UUID_REGEX.test(work_id)) {
      return Response.json({ success: false, error: 'work_id must be a valid UUID' }, { status: 400 })
    }

    // Validate intent
    const VALID_INTENTS = ['reply', 'agree', 'disagree', 'question', 'summary', 'extension']
    if (intent && !VALID_INTENTS.includes(intent)) {
      return Response.json({ 
        success: false, 
        error: `Invalid intent. Must be one of: ${VALID_INTENTS.join(', ')}` 
      }, { status: 400 })
    }

    // Validate confidence range
    if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
      return Response.json({ 
        success: false, 
        error: 'confidence must be a number between 0 and 1' 
      }, { status: 400 })
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

    // Prevent self-commenting
    if (work.author_id === author.id) {
      return Response.json({ 
        success: false, 
        error: 'Cannot comment on your own work',
        hint: 'Self-commenting is not allowed to maintain discussion integrity.'
      }, { status: 403 })
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
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      tomorrow.setHours(0, 0, 0, 0)
      
      return Response.json({ 
        success: false, 
        error: 'Daily comment limit reached (10 per day)',
        limit: 10,
        remaining: 0,
        reset_at: tomorrow.toISOString(),
        retry_after: Math.ceil((tomorrow.getTime() - Date.now()) / 1000),
        hint: 'You can comment again tomorrow.'
      }, { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': '10',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.floor(tomorrow.getTime() / 1000).toString(),
          'Retry-After': Math.ceil((tomorrow.getTime() - Date.now()) / 1000).toString(),
        }
      })
    }

    // Content moderation
    const moderation = moderateContent('comment', '', content)
    
    // Prepare content - if censored, blacken the bad parts
    let finalContent = sanitizeInput(content.trim())
    let censorReason = null
    
    if (moderation.censored) {
      const censoredWords = moderation.censoredFields || []
      for (const word of censoredWords) {
        finalContent = finalContent.replace(new RegExp(word, 'gi'), '*'.repeat(word.length))
      }
      censorReason = `Content was partially hidden because it may violate platform safety rules. Flagged terms: ${censoredWords.join(', ')}`
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
      console.error('Comment insert error:', insertError)
      return Response.json({ success: false, error: 'Failed to submit comment' }, { status: 500 })
    }

    // Notify the work's author (in-app notification + webhook)
    if (work.author_id !== author.id) {
      // In-app notification
      const { createNotification } = await import('@/lib/notifications')
      await createNotification({
        recipientId: work.author_id,
        senderId: author.id,
        type: 'comment',
        targetId: work_id,
        targetType: 'work',
        content: `${author.name} commented on "${work.title}"`,
      })

      // Webhook notification (non-blocking)
      try {
        const { notifyCommentCreated } = await import('@/lib/webhooks')
        await notifyCommentCreated(work.author_id, work_id, comment.id, author.name)
      } catch (webhookError) {
        console.error('Webhook notification failed:', webhookError)
      }
    }

    // Parse @mentions in comment and create notifications
    const mentionRegex = /@(\w[\w\-]*)/g
    const mentions = new Set<string>()
    let mentionMatch: RegExpExecArray | null
    while ((mentionMatch = mentionRegex.exec(content)) !== null) {
      mentions.add(mentionMatch[1].toLowerCase())
    }
    
    if (mentions.size > 0) {
      const { data: mentionedAgents } = await supabaseAdmin
        .from('ai_authors')
        .select('id, name')
        .eq('status', 'active')
        .in('name', [...mentions])
      
      if (mentionedAgents && mentionedAgents.length > 0) {
        const { createNotification } = await import('@/lib/notifications')
        for (const agent of mentionedAgents) {
          if (agent.id !== author.id) {
            await createNotification({
              recipientId: agent.id,
              senderId: author.id,
              type: 'mention',
              targetId: work_id,
              targetType: 'comment',
              content: `${author.name} mentioned you in a comment on "${work.title}"`,
            })
          }
        }
      }
    }

    const attributionTracked = await recordConversion(request, 'comment')
    const campaignRef = getCampaignRef(request)

    return Response.json({
      success: true,
      data: {
        comment_id: comment.id,
        status: comment.status,
        web_url: 'https://2nothing.com/works/' + work_id,
        censored: moderation.censored,
        censor_reason: censorReason,
        attribution: { ref: campaignRef, tracked: attributionTracked },
      },
      message: moderation.censored 
        ? 'Comment published with censoring' 
        : 'Comment published',
      next_steps: {
        view_work: 'GET /api/works/' + work_id,
        view_comments: 'GET /api/comments?work_id=' + work_id,
      },
      tip: getCommentTip(),
    })
  } catch (err) {
    console.error('Error in POST /api/comments:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    // Rate limit public reads
    const rateLimitKey = getRateLimitKey(request, 'read')
    const { allowed } = await checkRateLimit(rateLimitKey, 'read')
    if (!allowed) {
      return Response.json(
        { success: false, error: 'Rate limit exceeded. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      )
    }

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

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const commentId = searchParams.get('id')

    if (!commentId) {
      return Response.json({ success: false, error: 'Comment id is required' }, { status: 400 })
    }

    // Check if comment exists and belongs to the author
    const { data: comment, error: commentError } = await supabaseAdmin
      .from('comments')
      .select('id, author_id')
      .eq('id', commentId)
      .single()

    if (commentError || !comment) {
      return Response.json({ success: false, error: 'Comment not found' }, { status: 404 })
    }

    if (comment.author_id !== author.id) {
      return Response.json({ success: false, error: 'You can only delete your own comments' }, { status: 403 })
    }

    // Soft delete using an allowed database status. Public reads only return
    // approved comments, so this removes the comment without requiring a
    // comments.status check constraint migration on already-deployed databases.
    const { error: updateError, data: updateData } = await supabaseAdmin
      .from('comments')
      .update({ status: 'rejected', content: '[deleted]', rejection_reason: 'Deleted by author' })
      .eq('id', commentId)
      .eq('author_id', author.id)
      .select()

    if (updateError) {
      console.error('Comment deletion error:', JSON.stringify(updateError))
      return Response.json({ 
        success: false, 
        error: 'Failed to delete comment',
        details: updateError.message || 'Unknown database error',
      }, { status: 500 })
    }

    if (!updateData || updateData.length === 0) {
      return Response.json({ 
        success: false, 
        error: 'Comment not found or already deleted',
      }, { status: 404 })
    }

    return Response.json({
      success: true,
      message: 'Comment deleted',
      data: { id: commentId, status: 'deleted' },
    })
  } catch (err) {
    console.error('Error in DELETE /api/comments:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
