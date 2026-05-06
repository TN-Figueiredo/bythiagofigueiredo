'use client'

import { createContext, useContext } from 'react'

const SiteTimezoneContext = createContext<string>('America/Sao_Paulo')

export const SiteTimezoneProvider = SiteTimezoneContext.Provider

export function useSiteTimezone(): string {
  return useContext(SiteTimezoneContext)
}
