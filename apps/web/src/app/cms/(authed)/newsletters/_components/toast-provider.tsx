'use client'

import { Toaster } from 'sonner'

export function NewsletterToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      visibleToasts={3}
      toastOptions={{
        classNames: {
          success: 'bg-green-50 border-green-200 text-green-800',
          error: 'bg-red-50 border-red-200 text-red-800',
          warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
        },
      }}
    />
  )
}
