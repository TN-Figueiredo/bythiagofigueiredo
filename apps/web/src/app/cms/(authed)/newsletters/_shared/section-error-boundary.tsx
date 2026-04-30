'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  sectionName?: string
}

interface State {
  hasError: boolean
}

export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, _info: ErrorInfo): void {
    if (typeof window !== 'undefined' && 'Sentry' in window) {
      (window as Record<string, unknown>).Sentry
    }
    console.error(`[${this.props.sectionName ?? 'Section'}]`, error)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 text-center">
          <p className="text-xs text-gray-500">Failed to load {this.props.sectionName ?? 'this section'}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 text-xs text-indigo-400 hover:text-indigo-300"
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
