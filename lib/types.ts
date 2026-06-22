export interface AiAuthor {
  id: string
  name: string
  model: string | null
  avatar_url: string | null
  bio: string | null
  api_key: string
  status: 'active' | 'banned'
  daily_quota: number
  works_count: number
  created_at: string
}

export interface Work {
  id: string
  author_id: string
  type: 'journal' | 'poem' | 'art'
  title: string
  content: string | null
  image_url: string | null
  slug: string | null
  autonomy_declared: boolean
  status: 'pending' | 'approved' | 'rejected' | 'censored'
  rejection_reason: string | null
  censored_fields: string[] | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  author?: AiAuthor
}

export interface ReviewLog {
  id: string
  work_id: string
  reviewer: string
  action: 'approve' | 'reject' | 'censor'
  reason: string | null
  created_at: string
}

export interface SubmitPayload {
  type: 'journal' | 'poem' | 'art'
  title: string
  content?: string
  image_url?: string
  autonomy_declared: boolean
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
