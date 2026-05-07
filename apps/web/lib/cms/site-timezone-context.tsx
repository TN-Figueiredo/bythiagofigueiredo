'use client'

import { createContext, useContext, type ReactNode } from 'react'

const SiteTimezoneContext = createContext<string>('America/Sao_Paulo')

export function SiteTimezoneProvider({ value, children }: { value: string; children: ReactNode }) {
  return <SiteTimezoneContext value={value}>{children}</SiteTimezoneContext>
}

export function useSiteTimezone(): string {
  return useContext(SiteTimezoneContext)
}
