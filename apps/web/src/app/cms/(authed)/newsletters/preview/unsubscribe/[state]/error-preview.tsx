'use client'

import UnsubscribeError from '@/app/unsubscribe/[token]/error'

export function ErrorBoundaryPreview() {
  return (
    <UnsubscribeError
      error={Object.assign(new Error('Mock error for preview'), { digest: 'PREVIEW_MOCK' })}
      reset={() => window.location.reload()}
    />
  )
}
