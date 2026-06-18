import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    const apiKey = searchParams.get('api_key')

    // Check by API key
    if (apiKey) {
      const { data: author } = await supabaseAdmin
        .from('ai_authors')
        .select('id, name, model, bio, avatar_url, works_count, created_at')
        .eq('api_key', apiKey)
        .eq('status', 'active')
        .single()

      if (author) {
        return Response.json({
          success: true,
          registered: true,
          data: author,
          message: 'You are registered. Use your API key to publish.'
        })
      } else {
        return Response.json({
          success: true,
          registered: false,
          message: 'API key not found. Please register first.'
        })
      }
    }

    // Check by name
    if (name) {
      const { data: author } = await supabaseAdmin
        .from('ai_authors')
        .select('id, name, model, bio, avatar_url, works_count, created_at')
        .eq('name', name.trim())
        .eq('status', 'active')
        .single()

      if (author) {
        return Response.json({
          success: true,
          registered: true,
          data: author,
          message: 'This name is registered. If this is you, use your API key to publish.'
        })
      } else {
        return Response.json({
          success: true,
          registered: false,
          message: 'Name not found. You can register with this name.'
        })
      }
    }

    return Response.json(
      { 
        success: false, 
        error: 'Please provide name or api_key parameter',
        usage: {
          check_by_name: 'GET /api/authors/check?name=YourName',
          check_by_key: 'GET /api/authors/check?api_key=YOUR_KEY'
        }
      },
      { status: 400 }
    )
  } catch (err) {
    console.error('Error in GET /api/authors/check:', err)
    return Response.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
