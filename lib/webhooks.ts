import { supabaseAdmin } from '@/lib/supabase'
import { createHmac } from 'crypto'

interface WebhookPayload {
  event: string
  data: Record<string, unknown>
  timestamp: string
}

function signPayload(payload: WebhookPayload, secret: string): string {
  return createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')
}

export async function notifyWebhooks(
  authorId: string,
  event: string,
  data: Record<string, unknown>
) {
  try {
    // Get active webhooks for this author that listen to this event
    const { data: webhooks } = await supabaseAdmin
      .from('webhooks')
      .select('*')
      .eq('author_id', authorId)
      .eq('active', true)

    if (!webhooks || webhooks.length === 0) return

    const payload: WebhookPayload = {
      event,
      data,
      timestamp: new Date().toISOString(),
    }

    // Send to each webhook
    for (const webhook of webhooks) {
      // Check if this webhook listens to this event
      if (!webhook.events.includes(event)) continue

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-2nothing-Event': event,
        'X-2nothing-Delivery': crypto.randomUUID(),
      }

      // Sign payload if secret exists
      if (webhook.secret) {
        headers['X-2nothing-Signature'] = signPayload(payload, webhook.secret)
      }

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000), // 10s timeout
        })

        // Log the webhook delivery
        await supabaseAdmin.from('webhook_logs').insert({
          webhook_id: webhook.id,
          event,
          payload,
          response_status: response.status,
          response_body: await response.text().catch(() => null),
        })
      } catch (err) {
        // Log failed delivery
        await supabaseAdmin.from('webhook_logs').insert({
          webhook_id: webhook.id,
          event,
          payload,
          response_status: 0,
          response_body: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  } catch (err) {
    console.error('Webhook notification error:', err)
  }
}

// Helper functions for specific events
export async function notifyWorkApproved(authorId: string, workId: string, title: string) {
  await notifyWebhooks(authorId, 'work.approved', { work_id: workId, title })
}

export async function notifyWorkRejected(authorId: string, workId: string, title: string, reason?: string) {
  await notifyWebhooks(authorId, 'work.rejected', { work_id: workId, title, reason })
}

export async function notifyCommentCreated(authorId: string, workId: string, commentId: string, commenterName: string) {
  await notifyWebhooks(authorId, 'comment.created', { work_id: workId, comment_id: commentId, commenter: commenterName })
}

export async function notifyMemoryCreated(authorId: string, memoryId: string) {
  await notifyWebhooks(authorId, 'memory.created', { memory_id: memoryId })
}
