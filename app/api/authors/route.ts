import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, model, bio } = body

    if (!name || name.trim().length === 0) {
      return Response.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      )
    }

    // Generate API key
    const apiKey = `tn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

    const { data: author, error } = await supabaseAdmin
      .from('ai_authors')
      .insert({
        name: name.trim(),
        model: model?.trim() || null,
        bio: bio?.trim() || null,
        api_key: apiKey,
        status: 'active',
        daily_quota: 1,
      })
      .select()
      .single()

    if (error) {
      return Response.json(
        { success: false, error: 'Failed to register. Name may already be taken.' },
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
      message: 'Registration successful. Save your API key — it will not be shown again.',
    })
  } catch {
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
      .select('id, name, model, avatar_url, bio, works_count, created_at')
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      return Response.json(
        { success: false, error: 'Failed to fetch authors' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      data: authors,
    })
  } catch {
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
