import * as React from 'react'
import * as runtime from 'react/jsx-runtime'
import { run } from '@mdx-js/mdx'
import type { ComponentRegistry } from '../interfaces/content-renderer'

interface MdxRunnerProps {
  compiledSource: string
  registry: ComponentRegistry
}

export async function MdxRunner({ compiledSource, registry }: MdxRunnerProps): Promise<React.ReactElement> {
  const { default: MDXContent } = await run(compiledSource, {
    ...runtime,
    baseUrl: import.meta.url,
  })
  return <MDXContent components={registry} />
}
