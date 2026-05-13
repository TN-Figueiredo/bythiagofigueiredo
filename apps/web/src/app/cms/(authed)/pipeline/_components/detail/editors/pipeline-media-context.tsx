'use client'

import { createContext, useContext, type ReactNode } from 'react'

export interface ImageSelectResult {
  url: string
  alt: string
}

type RequestImageFn = (onSelect: (result: ImageSelectResult) => void) => void

const PipelineMediaContext = createContext<RequestImageFn | null>(null)

export function usePipelineMedia() {
  return useContext(PipelineMediaContext)
}

interface ProviderProps {
  onRequestImage: (onSelect: (result: ImageSelectResult) => void) => void
  children: ReactNode
}

export function PipelineMediaProvider({ onRequestImage, children }: ProviderProps) {
  return (
    <PipelineMediaContext.Provider value={onRequestImage}>
      {children}
    </PipelineMediaContext.Provider>
  )
}
