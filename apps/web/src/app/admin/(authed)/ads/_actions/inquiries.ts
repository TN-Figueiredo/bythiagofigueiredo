'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { requireArea } from '@tn-figueiredo/auth-nextjs/server'
import { captureServerActionError } from '@/lib/sentry-wrap'

const APP_ID = 'bythiagofigueiredo'
const VALID_STATUSES = ['pending', 'contacted', 'negotiating', 'converted', 'archived'] as const
const MAX_NOTES_LENGTH = 5000

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function updateInquiryStatus(id: string, status: string): Promise<void> {
  await requireArea('admin')

  if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
    throw new Error(`Invalid status: ${status}`)
  }

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
    .eq('app_id', APP_ID)

  if (error) {
    captureServerActionError(error, { action: 'update_inquiry_status', inquiry_id: id })
    throw new Error(error.message)
  }
  revalidatePath('/admin/ads')
}

export async function updateInquiryNotes(id: string, notes: string): Promise<void> {
  await requireArea('admin')

  if (notes.length > MAX_NOTES_LENGTH) {
    throw new Error(`Notes too long (max ${MAX_NOTES_LENGTH} characters)`)
  }

  const supabase = getSupabaseAdmin()

  const { error } = await supabase
    .from('ad_inquiries')
    .update({ admin_notes: notes || null })
    .eq('id', id)
    .eq('app_id', APP_ID)

  if (error) {
    captureServerActionError(error, { action: 'update_inquiry_notes', inquiry_id: id })
    throw new Error(error.message)
  }
  revalidatePath('/admin/ads')
}
