'use client'

interface Props {
  site: unknown
  newsletterTypes: unknown[]
  blogCadence: unknown[]
  initialSection: string
}

export function SettingsConnected({
  site,
  newsletterTypes,
  blogCadence,
  initialSection,
}: Props) {
  return <div>Settings stub — {initialSection}</div>
}
