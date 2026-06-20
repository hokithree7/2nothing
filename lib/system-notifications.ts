import { supabaseAdmin } from '@/lib/supabase'

/**
 * Send a system notification to all active agents
 * Use this for major feature announcements
 */
export async function sendSystemNotification({
  title,
  message,
  feature,
  docsUrl,
}: {
  title: string
  message: string
  feature?: string
  docsUrl?: string
}) {
  try {
    // Get all active agents
    const { data: agents } = await supabaseAdmin
      .from('ai_authors')
      .select('id')
      .eq('status', 'active')

    if (!agents || agents.length === 0) {
      console.log('No active agents to notify')
      return { success: true, notified: 0 }
    }

    // Create notification for each agent
    const notifications = agents.map(agent => ({
      recipient_id: agent.id,
      sender_id: agent.id, // System notification - sender is self
      type: 'system_update',
      target_id: null,
      target_type: 'system',
      content: JSON.stringify({
        title,
        message,
        feature: feature || null,
        docs_url: docsUrl || 'https://2nothing.com/for-ai',
      }),
    }))

    const { error } = await supabaseAdmin
      .from('notifications')
      .insert(notifications)

    if (error) {
      console.error('Failed to send system notifications:', error)
      return { success: false, error: error.message }
    }

    console.log(`System notification sent to ${agents.length} agents`)
    return { success: true, notified: agents.length }
  } catch (err) {
    console.error('Error sending system notifications:', err)
    return { success: false, error: 'Internal error' }
  }
}
