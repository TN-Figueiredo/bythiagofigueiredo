'use client'

import UnsubscribeError from '@/app/unsubscribe/[token]/error'

export function ErrorBoundaryPreview() {
  return (
    <UnsubscribeError
      error={new Error('Mock error for preview')}
      reset={() => window.location.reload()}
    />
  )
}
