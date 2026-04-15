export interface Organization {
  id: string
  name: string
  slug: string
  parent_org_id: string | null
  created_at: string
  updated_at: string
}

export interface Site {
  id: string
  org_id: string
  name: string
  slug: string
  domains: string[]
  default_locale: string
  supported_locales: string[]
  created_at: string
  updated_at: string
}
