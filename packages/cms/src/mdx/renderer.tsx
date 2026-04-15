import * as React from 'react'
import * as runtime from 'react/jsx-runtime'
import { run } from '@mdx-js/mdx'
import type { ComponentRegistry } from '../interfaces/content-renderer'

interface MdxRunnerProps {
  compiledSource: string
  registry: ComponentRegistry
  fallback?: React.ReactNode
}

export async function MdxRunner({ compiledSource, registry, fallback }: MdxRunnerProps): Promise<React.ReactElement> {
  try {
    const { default: MDXContent } = await run(compiledSource, {
      ...runtime,
      baseUrl: import.meta.url,
    })
    return <MDXContent components={registry} />
  } catch (e) {
    // Corrupted compiledSource or runtime error — render fallback or a minimal error boundary.
    if (fallback) return <>{fallback}</>
    return (
      <div role="alert" data-mdx-error>
        <p>Failed to render content.</p>
        {process.env.NODE_ENV !== 'production' && (
          <pre>{e instanceof Error ? e.message : String(e)}</pre>
        )}
      </div>
    )
  }
}
