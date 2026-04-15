import { compile } from '@mdx-js/mdx'
import type { CompiledMdx } from '../types/content'
import type { ComponentRegistry } from '../interfaces/content-renderer'
import { extractToc } from './toc'
import { calculateReadingTime } from './reading-time'

export async function compileMdx(
  source: string,
  registry: ComponentRegistry,
): Promise<CompiledMdx> {
  const allowed = Object.keys(registry)

  const vfile = await compile(source, {
    outputFormat: 'function-body',
    development: false,
    jsx: false,
    providerImportSource: undefined,
  })

  const compiledSource = String(vfile)

  // Soft allowlist warning (not a security boundary — server-only call)
  for (const m of source.matchAll(/<([A-Z][A-Za-z0-9]*)/g)) {
    const name = m[1]!
    if (!allowed.includes(name)) {
      // eslint-disable-next-line no-console
      console.warn(`[cms] MDX uses <${name}/> which is not in the registry; it will render as unknown.`)
    }
  }

  return {
    compiledSource,
    toc: extractToc(source),
    readingTimeMin: calculateReadingTime(source),
  }
}
