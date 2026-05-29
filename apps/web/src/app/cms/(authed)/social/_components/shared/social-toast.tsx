'use client'

import { toast } from 'sonner'

type SocialEvent =
  | 'post_published'
  | 'post_scheduled'
  | 'post_queued'
  | 'post_deleted'
  | 'post_duplicated'
  | 'draft_saved'
  | 'queue_reordered'
  | 'connection_error'
  | 'publish_failed'

const EVENT_MESSAGES: Record<SocialEvent, { title: string; type: 'success' | 'error' | 'info' }> = {
  post_published: { title: 'Post publicado', type: 'success' },
  post_scheduled: { title: 'Post agendado', type: 'success' },
  post_queued: { title: 'Adicionado a fila', type: 'success' },
  post_deleted: { title: 'Post excluido', type: 'info' },
  post_duplicated: { title: 'Post duplicado como rascunho', type: 'success' },
  draft_saved: { title: 'Rascunho salvo', type: 'success' },
  queue_reordered: { title: 'Fila reordenada', type: 'info' },
  connection_error: { title: 'Erro de conexao', type: 'error' },
  publish_failed: { title: 'Falha ao publicar', type: 'error' },
}

export function socialToast(event: SocialEvent, description?: string) {
  const config = EVENT_MESSAGES[event]
  if (config.type === 'error') {
    toast.error(config.title, { description })
  } else if (config.type === 'success') {
    toast.success(config.title, { description })
  } else {
    toast.info(config.title, { description })
  }
}
