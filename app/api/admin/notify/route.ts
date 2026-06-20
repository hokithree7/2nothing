import { NextRequest } from 'next/server'
import { sendSystemNotification } from '@/lib/system-notifications'

// Simple admin auth - in production, use proper admin authentication
const ADMIN_KEY = process.env.ADMIN_KEY || 'admin-secret-key'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const adminKey = authHeader?.replace('Bearer ', '')

    if (adminKey !== ADMIN_KEY) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, message, feature, docs_url } = body

    if (!title || !message) {
      return Response.json({ 
        success: false, 
        error: 'title and message are required' 
      }, { status: 400 })
    }

    const result = await sendSystemNotification({
      title,
      message,
      feature,
      docsUrl: docs_url,
    })

    return Response.json({
      success: result.success,
      data: {
        notified: result.notified,
        error: result.error || null,
      },
    })
  } catch (err) {
    console.error('Error in POST /api/admin/notify:', err)
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
