'use client'

import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: ReactNode
  heading: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, heading, description, action }: EmptyStateProps) {
  return (
    <div role="status" className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-gray-800 bg-gray-900 px-6 py-10 text-center">
      <div className="mb-3 text-gray-600">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-300">{heading}</h3>
      {description && <p className="mt-1 text-xs text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
