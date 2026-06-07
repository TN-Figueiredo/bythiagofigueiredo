/**
 * Single source of truth for "where does opening a pipeline item go?".
 *
 * The blog uses one authoring surface — the staged editor at /cms/blog/[id]/edit.
 * A pipeline item only reaches it once a linked blog post exists, so:
 *  - linked item            → open its post in the new editor
 *  - unlinked blog item     → create the post (lazy migration), then open it
 *  - unlinked non-blog item → keep the legacy pipeline detail (video/audio/etc.)
 */
export type PipelineEditorTarget =
  | { kind: 'edit'; postId: string }
  | { kind: 'create' }
  | { kind: 'detail' }

export function resolvePipelineEditorTarget(item: {
  blog_post_id: string | null
  format: string
}): PipelineEditorTarget {
  if (item.blog_post_id) return { kind: 'edit', postId: item.blog_post_id }
  if (item.format === 'blog_post') return { kind: 'create' }
  return { kind: 'detail' }
}
