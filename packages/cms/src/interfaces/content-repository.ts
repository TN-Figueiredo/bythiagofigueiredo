import type { ContentListOpts, ContentCountOpts, ContentStatus } from '../types/content'

export interface IContentRepository<T, TCreate, TUpdate, TListItem> {
  list(opts: ContentListOpts): Promise<TListItem[]>
  getById(id: string): Promise<T | null>
  getBySlug(opts: { siteId: string; locale: string; slug: string }): Promise<T | null>
  create(input: TCreate): Promise<T>
  update(id: string, patch: TUpdate): Promise<T>
  publish(id: string): Promise<T>
  unpublish(id: string): Promise<T>
  schedule(id: string, scheduledFor: Date): Promise<T>
  archive(id: string): Promise<T>
  delete(id: string): Promise<void>
  count(opts: ContentCountOpts): Promise<number>
  saveDraft?(id: string, patch: TUpdate): Promise<T>
}

export type { ContentListOpts, ContentCountOpts, ContentStatus }
