import { compileMdx } from '../mdx/compiler'
import type { ComponentRegistry } from '../interfaces/content-renderer'
import type { CompiledMdx } from '../types/content'

/**
 * Compile a campaign landing-page markdown block (main_hook_md,
 * supporting_argument_md, introductory_block_md, body_content_md,
 * form_intro_md) to a runnable MDX module.
 *
 * Campaign bodies are markdown-first (no MDX components required for the
 * current schema), but we still route through `compileMdx` so consumers get
 * TOC + reading-time out of the box and can opt in to the same MDX component
 * registry used by blog posts.
 *
 * The block-rendering UI for `extras` is project-specific (see
 * `apps/web/src/app/campaigns/[locale]/[slug]/extras-renderer.tsx` in the
 * bythiagofigueiredo hub). We intentionally do NOT move that React component
 * into the CMS package yet — it depends on a Zod schema for the extras
 * discriminated union that has not been stabilised across rings. Once a
 * second consumer ships, lift the schema + renderer here.
 */
export async function renderCampaignLandingMarkdown(
  body: string | null | undefined,
  registry: ComponentRegistry = {},
): Promise<CompiledMdx | null> {
  if (!body || body.trim().length === 0) return null
  return compileMdx(body, registry)
}
