import type { ContentListOpts, ContentCountOpts } from './content-repository'
import type {
  Campaign,
  CampaignListItem,
  CreateCampaignInput,
  UpdateCampaignInput,
} from '../types/campaign'

/**
 * Campaign repository contract.
 *
 * Authz model (round 2 hardening): every write method REQUIRES `siteId` from
 * the caller. The implementation narrows each UPDATE/DELETE with
 * `.eq('site_id', siteId)` so that even if a caller somehow passes a row id
 * that belongs to another site, the statement matches zero rows instead of
 * crossing a ring boundary. Service-role clients bypass RLS — this filter is
 * the last defense. Callers MUST first validate `can_admin_site(siteId)`
 * themselves (e.g. via `requireSiteAdminForRow`).
 *
 * Getters (`getById`, `getBySlug`) also require `siteId` so reads are site-
 * scoped by default. If a cross-site admin read is ever needed, add a new
 * explicit method rather than widening these.
 */
export interface ICampaignRepository {
  list(opts: ContentListOpts): Promise<CampaignListItem[]>
  /** Site-scoped read. Returns null when the campaign id is missing OR belongs to another site. */
  getById(id: string, siteId: string): Promise<Campaign | null>
  getBySlug(opts: { siteId: string; locale: string; slug: string }): Promise<Campaign | null>
  create(input: CreateCampaignInput): Promise<Campaign>
  /** Caller must prove site admin before calling. `.eq('site_id', siteId)` narrows the update. */
  update(id: string, siteId: string, patch: UpdateCampaignInput): Promise<Campaign>
  publish(id: string, siteId: string): Promise<Campaign>
  unpublish(id: string, siteId: string): Promise<Campaign>
  schedule(id: string, siteId: string, scheduledFor: Date): Promise<Campaign>
  archive(id: string, siteId: string): Promise<Campaign>
  delete(id: string, siteId: string): Promise<void>
  count(opts: ContentCountOpts): Promise<number>
}
