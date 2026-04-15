import type { IContentRepository } from './content-repository'
import type {
  Campaign,
  CampaignListItem,
  CreateCampaignInput,
  UpdateCampaignInput,
} from '../types/campaign'

/**
 * Campaign repository contract. Mirrors `IPostRepository` shape but models
 * landing-page campaigns (interest + PDF + Brevo list + translations).
 *
 * Authz NOTE: implementations typically use a service-role Supabase client
 * (bypassing RLS). Callers MUST validate `can_admin_site(siteId)` BEFORE
 * invoking write methods — this interface does not enforce authz.
 */
export type ICampaignRepository = IContentRepository<
  Campaign,
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignListItem
>
