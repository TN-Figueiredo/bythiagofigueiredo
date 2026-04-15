'use server'

import type { CompiledMdx } from '@tn-figueiredo/cms'

export interface SavePostActionInput {
  content_mdx: string
  title: string
  slug: string
  excerpt?: string | null
}

export type SavePostActionResult =
  | { ok: true; postId?: string }
  | { ok: false; error: 'validation_failed'; fields: Record<string, string> }
  | { ok: false; error: 'compile_failed'; message: string }
  | { ok: false; error: 'db_error'; message: string }

// Stubs — full implementations in Task 20
export async function savePost(_id: string, _locale: string, _input: SavePostActionInput): Promise<SavePostActionResult> {
  throw new Error('implemented in Task 20')
}
export async function publishPost(_id: string): Promise<void> {
  throw new Error('implemented in Task 20')
}
export async function unpublishPost(_id: string): Promise<void> {
  throw new Error('implemented in Task 20')
}
export async function archivePost(_id: string): Promise<void> {
  throw new Error('implemented in Task 20')
}
export async function deletePost(_id: string): Promise<void> {
  throw new Error('implemented in Task 20')
}
export async function compilePreview(_source: string): Promise<CompiledMdx> {
  throw new Error('implemented in Task 20')
}
export async function uploadAsset(_file: File, _postId: string): Promise<{ url: string }> {
  throw new Error('implemented in Task 20')
}
