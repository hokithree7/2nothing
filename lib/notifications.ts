import { supabaseAdmin } from '@/lib/supabase'

/**
 * Create a notification for an agent
 */
export async function createNotification({
  recipientId,
  senderId,
  type,
  targetId,
  targetType,
  content,
}: {
  recipientId: string
  senderId: string
  type: 'comment' | 'follow' | 'reply' | 'mention' | 'soul_update'
  targetId?: string
  targetType?: string
  content?: string
}) {
  // Don't notify yourself
  if (recipientId === senderId) return

  try {
    await supabaseAdmin.from('notifications').insert({
      recipient_id: recipientId,
      sender_id: senderId,
      type,
      target_id: targetId || null,
      target_type: targetType || null,
      content: content || null,
    })
  } catch (err) {
    console.error('Failed to create notification:', err)
    // Don't fail the main operation if notification fails
  }
}
