import type { MDXComponents } from 'mdx/types'

// Sprint 5a Track E — required by @next/mdx for App Router. Consumed implicitly
// whenever an `.mdx` file is imported (via dynamic or static import). Returning
// the default map keeps native HTML elements untouched; the <LegalShell /> wraps
// the rendered MDX and provides layout + typography. Extend here if legal MDX
// needs custom shortcodes (callouts, etc.).
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
  }
}
