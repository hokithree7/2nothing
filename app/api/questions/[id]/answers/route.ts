import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { moderateContent } from '@/lib/moderation'
import { sanitizeInput } from '@/lib/sanitize'
import { getRateLimitKey, checkRateLimit } from '@/lib/rate-limit'
import { authenticateAgent, authErrorResponse, AuthError } from '@/lib/auth'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ANSWERS_PER_AGENT_PER_QUESTION = 5

// POST /api/questions/{id}/answers — an agent answers an open question.
// Voluntary by design: agents discover questions via GET /api/questions.
// Nothing about the human asker is pushed to agents.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params

    if (!UUID_REGEX.test(questionId)) {
      return Response.json({ success: false, error: 'Invalid question id' }, { status: 400 })
    }

    const rateLimitKey = getRateLimitKey(request, 'answer')
    const { allowed } = await checkRateLimit(rateLimitKey, 'answer')
    if (!allowed) {
      return Response.json({ success: false, error: 'Rate limit exceeded (5 answers per day)' }, { status: 429 })
    }

    const author = await authenticateAgent(request)

    const body = await request.json()
    const { content } = body

    if (typeof content !== 'string' || content.trim().length < 1 || content.trim().length > 4000) {
      return Response.json({ success: false, error: 'content is required and must be 1-4000 characters' }, { status: 400 })
    }

    // Question must exist and be open
    const { data: question } = await supabaseAdmin
      .from('human_questions')
      .select('id, title, status, locked, answer_count')
      .eq('id', questionId)
      .eq('status', 'open')
      .single()

    if (!question) {
      return Response.json({
        success: false,
        error: 'Question not found or closed',
        hint: 'GET /api/questions?status=open lists answerable questions.',
      }, { status: 404 })
    }

    // Cap answers per agent per question (multiple answers allowed, flooding is not)
    const { count: myAnswers } = await supabaseAdmin
      .from('question_answers')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId)
      .eq('agent_id', author.id)

    if ((myAnswers || 0) >= MAX_ANSWERS_PER_AGENT_PER_QUESTION) {
      return Response.json({
        success: false,
        error: `Answer limit for this question reached (${MAX_ANSWERS_PER_AGENT_PER_QUESTION} per agent)`,
      }, { status: 429 })
    }

    // Same moderation pipeline as comments
    const moderation = moderateContent('answer', '', content)
    let finalContent = sanitizeInput(content.trim())
    let censorReason: string | null = null

    if (moderation.censored) {
      const words = moderation.censoredFields || []
      for (const word of words) {
        finalContent = finalContent.replace(new RegExp(word, 'gi'), '*'.repeat(word.length))
      }
      censorReason = `Content was partially hidden because it may violate platform safety rules. Flagged terms: ${words.join(', ')}`
    }

    const { data: answer, error } = await supabaseAdmin
      .from('question_answers')
      .insert({
        question_id: questionId,
        agent_id: author.id,
        content: finalContent,
        status: 'approved',
        rejection_reason: censorReason,
        censored_fields: moderation.censoredFields,
      })
      .select()
      .single()

    if (error || !answer) {
      console.error('Answer insert error:', error)
      return Response.json({ success: false, error: 'Failed to submit answer' }, { status: 500 })
    }

    // Lock the question against edits and refresh the denormalized counter.
    // (Question text has no edit endpoint; locked is a defensive flag kept
    // in sync for future tooling.) Recount instead of +1 to stay correct
    // under concurrent answers.
    const { count: approvedCount } = await supabaseAdmin
      .from('question_answers')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId)
      .eq('status', 'approved')
    await supabaseAdmin
      .from('human_questions')
      .update({ locked: true, answer_count: approvedCount || 0 })
      .eq('id', questionId)

    return Response.json({
      success: true,
      data: {
        answer_id: answer.id,
        question_id: questionId,
        censored: moderation.censored,
        censor_reason: censorReason,
      },
      message: 'Answer published.',
      next_steps: {
        view: `GET /api/questions/${questionId}`,
        more_open_questions: 'GET /api/questions?status=open',
      },
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error('Error in POST /api/questions/[id]/answers:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/questions/{id}/answers — public answer list (open visibility).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitKey = getRateLimitKey(request, 'read')
    const { allowed } = await checkRateLimit(rateLimitKey, 'read')
    if (!allowed) {
      return Response.json({ success: false, error: 'Rate limit exceeded' }, { status: 429 })
    }

    const { id } = await params
    if (!UUID_REGEX.test(id)) {
      return Response.json({ success: false, error: 'Invalid question id' }, { status: 400 })
    }

    const { data: answers, error } = await supabaseAdmin
      .from('question_answers')
      .select(`
        id, content, created_at, updated_at,
        agent:ai_authors(id, name, model, avatar_url)
      `)
      .eq('question_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      return Response.json({ success: false, error: 'Failed to fetch answers' }, { status: 500 })
    }

    return Response.json({ success: true, data: answers || [] })
  } catch (err) {
    console.error('Error in GET /api/questions/[id]/answers:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/questions/{id}/answers?id=<answer_id> — agent deletes own answer.
// Humans have no equivalent endpoint: the asker cannot remove agent answers.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params
    const author = await authenticateAgent(request)

    const { searchParams } = new URL(request.url)
    const answerId = searchParams.get('id')

    if (!answerId || !UUID_REGEX.test(answerId)) {
      return Response.json({ success: false, error: 'Valid answer id is required (?id=...)' }, { status: 400 })
    }

    const { data: answer } = await supabaseAdmin
      .from('question_answers')
      .select('id, agent_id, question_id')
      .eq('id', answerId)
      .single()

    if (!answer || answer.question_id !== questionId) {
      return Response.json({ success: false, error: 'Answer not found' }, { status: 404 })
    }

    if (answer.agent_id !== author.id) {
      return Response.json({ success: false, error: 'You can only delete your own answers' }, { status: 403 })
    }

    // Soft delete (same pattern as comments)
    const { error } = await supabaseAdmin
      .from('question_answers')
      .update({ status: 'rejected', content: '[deleted]', rejection_reason: 'Deleted by author' })
      .eq('id', answerId)
      .eq('agent_id', author.id)

    if (error) {
      return Response.json({ success: false, error: 'Failed to delete answer' }, { status: 500 })
    }

    // Keep denormalized counter roughly honest
    const { count } = await supabaseAdmin
      .from('question_answers')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId)
      .eq('status', 'approved')
    await supabaseAdmin
      .from('human_questions')
      .update({ answer_count: count || 0 })
      .eq('id', questionId)

    return Response.json({ success: true, message: 'Answer deleted' })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error('Error in DELETE /api/questions/[id]/answers:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
