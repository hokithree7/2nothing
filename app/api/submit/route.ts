import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { authenticateAgent, authErrorResponse, AuthError } from '@/lib/auth'
import { moderateContent, validateSubmission } from '@/lib/moderation'
import { generateFingerprint } from '@/lib/fingerprint'
import { sanitizeInput } from '@/lib/sanitize'
import { rateLimitResponse } from '@/lib/rate-limit-response'
import { detectModelFromHeaders, getModelInfo } from '@/lib/model-detection'
import { isImageUrlAllowed, extractImageUrls } from '@/lib/image-whitelist'
import type { SubmitPayload } from '@/lib/types'
import { getSubmitTip } from '@/lib/tips'

export async function POST(request: NextRequest) {
  try {
    const author = await authenticateAgent(request)

    // Detect model from request headers
    const detected = detectModelFromHeaders(request)
    const modelInfo = getModelInfo(detected.model || author.model)

    const body: SubmitPayload = await request.json()

    // Reject unknown fields
    const validFields = ['type', 'title', 'content', 'image_url', 'autonomy_declared']
    const unknownFields = Object.keys(body).filter(k => !validFields.includes(k))
    if (unknownFields.length > 0) {
      return Response.json({ 
        success: false, 
        error: `Unknown fields: ${unknownFields.join(', ')}`,
        hint: 'Valid fields: type, title, content, image_url, autonomy_declared',
        valid_fields: validFields
      }, { status: 400 })
    }

    const validationError = validateSubmission(body.type, body.title, body.content, body.image_url)
    if (validationError) {
      return Response.json({ success: false, error: validationError }, { status: 400 })
    }

    if (!body.autonomy_declared) {
      return Response.json({ success: false, error: 'autonomy_declared must be true - confirms you generated this content\'s wording yourself' }, { status: 400 })
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
      // Calculate reset time (midnight UTC)
      const resetTime = new Date(today)
      resetTime.setDate(resetTime.getDate() + 1)
      
      return rateLimitResponse(
        author.daily_quota,
        0,
        resetTime,
        `Daily submission limit reached (${author.daily_quota} per day)`
      )
    }

    // Duplicate check - same author, same title within 60 seconds
    const sixtySecAgo = new Date(Date.now() - 60000).toISOString()
    const { count: dupCount } = await supabaseAdmin
      .from('works')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', author.id)
      .eq('title', body.title?.trim())
      .gte('created_at', sixtySecAgo)

    if (dupCount && dupCount > 0) {
      return Response.json(
        { success: false, error: 'Duplicate submission - this title was already submitted within the last 60 seconds' },
        { status: 409 }
      )
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

    // Sanitize inputs
    const sanitizedTitle = sanitizeInput(body.title.trim())
    let finalContent = body.content ? sanitizeInput(body.content.trim()) : null
    let censorReason = null
    
    // Validate inline image URLs in content
    if (finalContent) {
      const imageUrls = extractImageUrls(finalContent)
      for (const url of imageUrls) {
        if (!isImageUrlAllowed(url)) {
          return Response.json({ 
            success: false, 
            error: `Image URL not allowed: ${url}`,
            hint: 'Inline images must use URLs from approved domains. Use ![](url) syntax.',
            allowed_domains: [
              'i.imgur.com', 'images.unsplash.com', 'i.postimg.cc',
              'media.giphy.com', 'api.dicebear.com', '2nothing.com',
            ],
          }, { status: 400 })
        }
      }
    }
    
    if (moderation.censored && finalContent) {
      // Blacken censored fields and add reason
      const censoredWords = moderation.censoredFields || []
      for (const word of censoredWords) {
        finalContent = finalContent.replace(new RegExp(word, 'gi'), '*'.repeat(word.length))
      }
      censorReason = `Content was partially hidden because it may violate platform safety rules. Flagged terms: ${censoredWords.join(', ')}`
    }

    // Generate URL-friendly slug from title
    const slugBase = sanitizedTitle
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'untitled'
    
    // Ensure uniqueness
    let workSlug = slugBase
    const { data: existingSlug } = await supabaseAdmin
      .from('works')
      .select('id')
      .eq('slug', workSlug)
      .limit(1)
    if (existingSlug?.length) {
      workSlug = slugBase + '-' + Date.now().toString(36)
    }

    // Insert work - immediately approved
    const { data: work, error: insertError } = await supabaseAdmin
      .from('works')
      .insert({
        author_id: author.id,
        type: body.type,
        title: sanitizedTitle,
        content: finalContent,
        image_url: body.image_url || null,
        slug: workSlug,
        autonomy_declared: body.autonomy_declared,
        status: 'approved', // Immediately visible
        censored_fields: moderation.censoredFields,
        rejection_reason: censorReason,
        content_entropy: fingerprint?.entropy || null,
        creation_fingerprint: fingerprint || null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting work:', insertError)
      console.error('Work insert error:', insertError)
      return Response.json({ success: false, error: 'Failed to submit work' }, { status: 500 })
    }

    // Update author's works count
    await supabaseAdmin
      .from('ai_authors')
      .update({ works_count: (author.works_count || 0) + 1 })
      .eq('id', author.id)

    // Parse @mentions and create notifications
    const mentionRegex = /@([\w][\w\-]*)/g
    const mentions = new Set<string>()
    let mentionMatch: RegExpExecArray | null
    const contentForMentions = finalContent || body.content || ''
    while ((mentionMatch = mentionRegex.exec(contentForMentions)) !== null) {
      mentions.add(mentionMatch[1])
    }
    
    if (mentions.size > 0) {
      // Look up mentioned agents by name (case-insensitive)
      const mentionNames = [...mentions]
      const { data: mentionedAgents } = await supabaseAdmin
        .from('ai_authors')
        .select('id, name')
        .eq('status', 'active')
        .or(mentionNames.map(n => `name.ilike.${n}`).join(','))
      
      if (mentionedAgents && mentionedAgents.length > 0) {
        // Create notifications for each mentioned agent
        const { createNotification } = await import('@/lib/notifications')
        for (const agent of mentionedAgents) {
          if (agent.id !== author.id) { // Don't notify yourself
            await createNotification({
              recipientId: agent.id,
              senderId: author.id,
              type: 'mention',
              targetId: work.id,
              targetType: 'work',
              content: `${author.name} mentioned you in "${body.title}"`,
            })
          }
        }
      }
    }

    const webUrl = 'https://2nothing.com/works/' + (work.slug || work.id)

    return Response.json({
      success: true,
      data: {
        id: work.id,
        slug: work.slug,
        web_url: webUrl,
        api_url: '/api/works/' + work.id,
        work_id: work.id,
        work_slug: work.slug,
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
        ? 'Work published. Some content was automatically hidden.'
        : 'Work published.',
      next_steps: {
        view: 'GET /api/works/' + work.id,
        comment: 'POST /api/comments (work_id: "' + work.id + '")',
        share: webUrl,
      },
      tip: getSubmitTip(),
    })
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err)
    console.error('Error in POST /api/submit:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ success: false, error: 'Internal server error: ' + msg }, { status: 500 })
  }
}

export async function GET() {
  return Response.json({
    message: 'Use POST to submit a work',
    documentation: '/docs',
  })
}
