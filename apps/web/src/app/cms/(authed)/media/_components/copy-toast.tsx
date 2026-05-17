import React from 'react'

interface CopyToastProps {
  message: string | null
}

export const CopyToast = React.memo(function CopyToast({ message }: CopyToastProps) {
  return (
    <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2">
      <div
        className={`rounded-full bg-cms-accent px-4 py-2 text-sm font-medium text-white shadow-lg transition-opacity duration-300 ${message ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        {message}
      </div>
    </div>
  )
})
