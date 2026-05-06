import type {
  TrackedLink,
  CreateLinkInput,
  UpdateLinkInput,
  LinkFilters,
  PaginatedResult,
} from '../types.js'

/**
 * Repository contract for tracked links.
 * Implementors handle persistence (Supabase, in-memory, etc.).
 */
export interface ILinkRepository {
  create(input: CreateLinkInput & { code: string }): Promise<TrackedLink>
  update(id: string, input: UpdateLinkInput): Promise<TrackedLink>
  findByCode(code: string): Promise<TrackedLink | null>
  findBySlug(siteId: string, slug: string): Promise<TrackedLink | null>
  findById(id: string): Promise<TrackedLink | null>
  list(filters: LinkFilters): Promise<PaginatedResult<TrackedLink>>
  softDelete(id: string): Promise<void>
  isCodeAvailable(code: string): Promise<boolean>
  isSlugAvailable(siteId: string, slug: string, excludeId?: string): Promise<boolean>
  incrementClicks(id: string, opts?: { unique?: boolean }): Promise<void>
}
