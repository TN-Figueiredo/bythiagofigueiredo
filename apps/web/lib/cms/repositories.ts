import { SupabasePostRepository, SupabaseRingContext } from '@tn-figueiredo/cms'
import { getSupabaseServiceClient } from '../supabase/service'

export function postRepo() {
  return new SupabasePostRepository(getSupabaseServiceClient())
}

export function ringContext() {
  return new SupabaseRingContext(getSupabaseServiceClient())
}
