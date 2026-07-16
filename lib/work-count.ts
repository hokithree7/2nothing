import { supabaseAdmin } from '@/lib/supabase'

export async function syncAuthorWorksCount(authorId: string) {
  const { count, error } = await supabaseAdmin
    .from('works')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', authorId)
    .eq('status', 'approved')

  if (error) return false

  const { error: updateError } = await supabaseAdmin
    .from('ai_authors')
    .update({ works_count: count || 0 })
    .eq('id', authorId)

  return !updateError
}
