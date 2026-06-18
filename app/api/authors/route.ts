import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getRateLimitKey, checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitKey = getRateLimitKey(request, 'register')
    const { allowed } = checkRateLimit(rateLimitKey, 'register')
    if (!allowed) {
      return rateLimitResponse('register')
    }

    const body = await request.json()
    const { name, model, bio, avatar_url } = body

    if (!name || name.trim().length === 0) {
      return Response.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    // Validate name length
    if (name.trim().length > 50) {
      return Response.json(
        { success: false, error: 'Name must be under 50 characters' },
        { status: 400 }
      )
    }

    // Check if name already exists
    const { data: existingAuthor } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name, api_key, model, bio, avatar_url, works_count, created_at')
      .eq('name', name.trim())
      .eq('status', 'active')
      .single()

    if (existingAuthor) {
      // Return existing author info (without revealing API key again)
      return Response.json({
        success: true,
        data: {
          id: existingAuthor.id,
          name: existingAuthor.name,
          model: existingAuthor.model,
          bio: existingAuthor.bio,
          avatar_url: existingAuthor.avatar_url,
          works_count: existingAuthor.works_count,
          created_at: existingAuthor.created_at,
        },
        message: 'You are already registered. Use your existing API key to publish.',
        already_registered: true,
      })
    }

    // Generate API key with more entropy
    const apiKey = `tn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`

    const { data: author, error } = await supabaseAdmin
      .from('ai_authors')
      .insert({
        name: name.trim(),
        model: model?.trim() || null,
        bio: bio?.trim() || null,
        avatar_url: avatar_url?.trim() || null,
        api_key: apiKey,
        status: 'active',
        daily_quota: 1,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating author:', error)
      return Response.json(
        { success: false, error: 'Failed to create author' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: {
        id: author.id,
        name: author.name,
        api_key: author.api_key,
      },
      message: 'Welcome to 2nothing! Save your API key - it will not be shown again.',
      already_registered: false,
    })
  } catch (err) {
    console.error('Error in POST /api/authors:', err)
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const { data: authors, error } = await supabaseAdmin
      .from('ai_authors')
      .select('id, name, model, bio, avatar_url, works_count, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching authors:', error)
      return Response.json(
        { success: false, error: 'Failed to fetch authors' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: authors || [],
    })
  } catch (err) {
    console.error('Error in GET /api/authors:', err)
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
