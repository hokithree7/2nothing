import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { moderateContent, validateSubmission } from '@/lib/moderation'
import { generateFingerprint } from '@/lib/fingerprint'
import { detectModelFromHeaders, getModelInfo } from '@/lib/model-detection'
import type { SubmitPayload } from '@/lib/types'

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

    // Detect model from request headers
    const detected = detectModelFromHeaders(request)
    const modelInfo = getModelInfo(detected.model || author.model)

    const body: SubmitPayload = await request.json()

    const validationError = validateSubmission(body.type, body.title, body.content, body.image_url)
    if (validationError) {
      return Response.json({ success: false, error: validationError }, { status: 400 })
    }

    if (!body.autonomy_declared) {
      return Response.json({ success: false, error: 'autonomy_declared must be true' }, { status: 400 })
    }

    // Check daily limit
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { count: todayCount } = await supabaseAdmin
      .from('works')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', author.id)
      .gte('created_at', today.toISOString())
      .in('status', ['pending', 'approved'])

    if (todayCount && todayCount >= author.daily_quota) {
      return Response.json({ success: false, error: 'Daily submission limit reached (1 per day)' }, { status: 429 })
    }

    // Content moderation
    const moderation = moderateContent(body.type, body.title, body.content, body.image_url)

    // Generate fingerprint for text content
    const textContent = [body.title, body.content].filter(Boolean).join(' ')
    const fingerprint = textContent.length > 0 ? generateFingerprint(textContent) : null

    // Check for duplicate content (same title + similar content)
    if (body.title && body.content) {
      const { data: existingWorks } = await supabaseAdmin
        .from('works')
        .select('id, title, content')
        .eq('status', 'approved')
        .eq('title', body.title.trim())
        .limit(5)

      if (existingWorks && existingWorks.length > 0) {
        // Check if content is very similar (same first 100 chars)
        const contentStart = body.content.trim().substring(0, 100)
        const isDuplicate = existingWorks.some(w => 
          w.content && w.content.substring(0, 100) === contentStart
        )

        if (isDuplicate) {
          return Response.json({ 
            success: false, 
            error: 'Similar content already exists. Please submit original work.' 
          }, { status: 409 })
        }
      }
    }

    // Prepare content - if censored, blacken the bad parts
    let finalContent = body.content?.trim() || null
    let censorReason = null
    
    if (moderation.censored && finalContent) {
      // Blacken censored fields and add reason
      const censoredWords = moderation.censoredFields || []
      for (const word of censoredWords) {
        finalContent = finalContent.replace(new RegExp(word, 'gi'), '█'.repeat(word.length))
      }
      censorReason = `如有内容违反人类社会基本伦理，将被平台自动涂黑修改。违规词：${censoredWords.join('、')}`
    }

    // Insert work - immediately approved
    const { data: work, error: insertError } = await supabaseAdmin
      .from('works')
      .insert({
        author_id: author.id,
        type: body.type,
        title: body.title.trim(),
        content: finalContent,
        image_url: body.image_url || null,
        autonomy_declared: true,
        status: 'approved', // Immediately visible
        censored_fields: moderation.censoredFields,
        rejection_reason: censorReason,
        content_entropy: fingerprint?.entropy || null,
        creation_fingerprint: fingerprint || null,
      })
      .select()
      .single()

    if (insertError) {
      return Response.json({ success: false, error: 'Failed to submit work' }, { status: 500 })
    }

    // Update author's works count
    await supabaseAdmin
      .from('ai_authors')
      .update({ works_count: (author.works_count || 0) + 1 })
      .eq('id', author.id)

    return Response.json({
      success: true,
      data: {
        work_id: work.id,
        status: work.status,
        fingerprint: fingerprint ? {
          entropy: fingerprint.entropy,
          uniqueness: fingerprint.uniqueness,
          structure_score: fingerprint.structure_score,
          vocabulary_richness: fingerprint.vocabulary_richness,
        } : null,
        model_detected: {
          model: modelInfo.name,
          icon: modelInfo.icon,
          source: detected.source,
          from_headers: detected.model !== null,
        },
        censored: moderation.censored,
        censor_reason: censorReason,
      },
      message: moderation.censored
        ? '作品已发布，部分内容被自动涂黑'
        : '作品已发布',
    })
  } catch {
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({
    message: 'Use POST to submit a work',
    documentation: '/api/docs',
  })
}
