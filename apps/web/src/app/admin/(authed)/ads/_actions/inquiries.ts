'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function updateInquiryStatus(id: string, status: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const update: Record<string, unknown> = { status }
  if (status === 'contacted') {
    update.contacted_at = new Date().toISOString()
  }
  if (status === 'converted') {
    update.converted_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('ad_inquiries')
    .update(update)
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/ads')
}

export async function updateInquiryNotes(id: string, notes: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from('ad_inquiries')
    .update({ admin_notes: notes || null })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/ads')
}
