import type { JsonLdGraph } from './types'

export function escapeJsonForScript(json: string): string {
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

export function JsonLdScript({ graph }: { graph: JsonLdGraph }) {
  if (process.env.NEXT_PUBLIC_SEO_JSONLD_ENABLED === 'false') return null
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: escapeJsonForScript(JSON.stringify(graph)) }}
    />
  )
}
