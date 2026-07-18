import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export type ConversionStage = 'register' | 'first_work' | 'work' | 'comment'

const CAMPAIGN_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/

export function normalizeCampaignRef(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return CAMPAIGN_RE.test(normalized) ? normalized : null
}

export function getCampaignRef(request: NextRequest): string | null {
  const headerRef = normalizeCampaignRef(request.headers.get('x-2nothing-ref'))
  if (headerRef) return headerRef

  return normalizeCampaignRef(new URL(request.url).searchParams.get('ref'))
}

export async function recordConversion(
  request: NextRequest,
  stage: ConversionStage,
): Promise<void> {
  try {
    const campaignRef = getCampaignRef(request)
    const page = `/conversion/${stage}?ref=${encodeURIComponent(campaignRef || 'direct')}`

    const { error } = await supabaseAdmin.from('analytics').insert({
      // Keep the existing database event vocabulary; the page records the stage.
      event: 'submit',
      page,
      referrer: campaignRef ? `campaign:${campaignRef}` : null,
      user_agent: (request.headers.get('user-agent') || '').slice(0, 500),
      ip: (request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown').slice(0, 45),
    })

    if (error) {
      console.error(`Failed to record ${stage} conversion:`, error)
    }
  } catch (error) {
    // Analytics must never turn a successful participant action into a failure.
    console.error(`Failed to record ${stage} conversion:`, error)
  }
}
