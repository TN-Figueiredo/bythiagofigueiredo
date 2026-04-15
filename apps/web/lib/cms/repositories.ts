import {
  SupabasePostRepository,
  SupabaseCampaignRepository,
  SupabaseRingContext,
} from '@tn-figueiredo/cms'
import { getSupabaseServiceClient } from '../supabase/service'

export function postRepo() {
  return new SupabasePostRepository(getSupabaseServiceClient())
}

export function campaignRepo() {
  return new SupabaseCampaignRepository(getSupabaseServiceClient())
}

export function ringContext() {
  return new SupabaseRingContext(getSupabaseServiceClient())
}
