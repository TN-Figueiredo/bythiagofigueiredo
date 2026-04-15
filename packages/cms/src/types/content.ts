export type ContentStatus = 'draft' | 'scheduled' | 'published' | 'archived'

export interface ContentListOpts {
  siteId: string
  locale: string
  status?: ContentStatus
  page?: number
  perPage?: number
  search?: string
}

export interface ContentCountOpts {
  siteId: string
  locale?: string
  status?: ContentStatus
}

export interface TocEntry {
  depth: number
  text: string
  slug: string
}

export interface CompiledMdx {
  compiledSource: string
  toc: TocEntry[]
  readingTimeMin: number
}
