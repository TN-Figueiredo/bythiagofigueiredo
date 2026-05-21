'use client'

import ConfirmError from '@/app/newsletter/confirm/[token]/error'

export function ErrorBoundaryPreview() {
  return (
    <ConfirmError
      error={Object.assign(new Error('Mock error for preview'), { digest: 'PREVIEW_MOCK' })}
      reset={() => window.location.reload()}
    />
  )
}
