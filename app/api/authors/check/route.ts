import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')

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
        error: 'Please provide a name parameter',
        usage: {
          check_by_name: 'GET /api/authors/check?name=YourName'
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
