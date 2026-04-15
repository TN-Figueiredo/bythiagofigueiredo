import type { SupabaseClient } from '@supabase/supabase-js'

export interface PostSignUpEvent {
  userId: string
  email: string
}

export function createOnPostSignUp(supabase: SupabaseClient) {
  return async (event: PostSignUpEvent): Promise<void> => {
    const local = event.email.split('@')[0] ?? 'user'
    const baseSlug =
      local.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'user'
    const slug = `${baseSlug}-${event.userId.slice(0, 8)}`
    const { error } = await supabase.from('authors').insert({
      user_id: event.userId,
      name: local,
      slug,
    })
    if (error) {
      console.error('[on-signup] author insert failed', {
        userId: event.userId,
        error: error.message,
      })
    }
  }
}
