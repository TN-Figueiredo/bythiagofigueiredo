'use client'

import type { NewsletterHubStrings } from '../../_i18n/types'

interface TestCenterTabProps {
  strings: NewsletterHubStrings
  locale: 'en' | 'pt-BR'
  userEmail: string
  types: Array<{ id: string; name: string; color: string }>
  editions: Array<{ id: string; subject: string; status: string; typeId: string | null }>
}

export function TestCenterTab({ strings }: TestCenterTabProps) {
  return (
    <div className="text-gray-400 text-sm py-8 text-center">
      {strings.tabs['test-center']} — under construction
    </div>
  )
}
