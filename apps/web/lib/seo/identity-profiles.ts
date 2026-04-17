export interface PersonProfile {
  type: 'person'
  name: string
  jobTitle: string
  imageUrl: string
  sameAs: string[]
}

export interface OrgProfile {
  type: 'organization'
  name: string
  legalName: string
  logoUrl: string
  founderName: string
  sameAs: string[]
}

export type IdentityProfile = PersonProfile | OrgProfile

export const IDENTITY_PROFILES: Record<string, IdentityProfile> = {
  bythiagofigueiredo: {
    type: 'person',
    name: 'Thiago Figueiredo',
    jobTitle: 'Creator & Builder',
    imageUrl: 'https://bythiagofigueiredo.com/identity/thiago.jpg',
    sameAs: [
      'https://www.instagram.com/thiagonfigueiredo',
      'https://www.youtube.com/@bythiagofigueiredo',
      'https://www.youtube.com/@thiagonfigueiredo',
      'https://github.com/tn-figueiredo',
    ],
  },
}

export function getIdentityProfile(siteSlug: string): IdentityProfile | null {
  return IDENTITY_PROFILES[siteSlug] ?? null
}
