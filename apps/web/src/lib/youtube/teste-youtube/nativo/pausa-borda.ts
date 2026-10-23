// Leitura (servidor) da pausa visível do nosso teste: só testes `paused` com `status_note = NOTA_TESTE_YOUTUBE`.
// Devolve `testId -> PausaYoutube`; vídeo sem registro aberto = `{ aberto: false }`. Falha de leitura (o chamador não precisa tratar:
// vira `{ aberto: true, ate: null }` para cada teste: falha fechada, Retomar desabilitado). Nunca mapa vazio como se fosse "tudo liberado".
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NOTA_TESTE_YOUTUBE } from '@/lib/youtube/ab-settle'
import { retomarAPartirDe } from './lista'
import type { PausaYoutube } from './pausa-visivel'

export interface TestePausado { id: string; status: string; status_note: string | null; youtube_video_id: string | null }

export async function lerPausasYoutube(
  sb: SupabaseClient, siteId: string, testes: readonly TestePausado[],
): Promise<Map<string, PausaYoutube>> {
  const alvo = testes.filter((t) => t.status === 'paused' && t.status_note === NOTA_TESTE_YOUTUBE && t.youtube_video_id)
  const saida = new Map<string, PausaYoutube>()
  if (alvo.length === 0) return saida
  const ids = [...new Set(alvo.map((t) => t.youtube_video_id as string))]
  const { data, error } = await sb.from('ab_native_tests')
    .select('video_id, confirmado_em, primeira_vista, created_at')
    .eq('site_id', siteId).eq('estado', 'em_andamento').in('video_id', ids)
  if (error) {
    // Falha fechada (Retomar desabilitado) e visível: sem isto um erro de banco travaria o Retomar em silêncio. Só contagem e site, nunca ids de vídeo.
    Sentry.captureMessage('pausa-borda: leitura do registro aberto falhou', { level: 'error', tags: { component: 'ab-lab-pausa-borda' }, extra: { siteId, testes: alvo.length, erro: error.message } })
    for (const t of alvo) saida.set(t.id, { aberto: true, ate: null })
    return saida
  }
  const porVideo = new Map<string, PausaYoutube>()
  for (const r of (data ?? []) as Array<{ video_id: string; confirmado_em: string | null; primeira_vista: string | null; created_at: string }>) {
    porVideo.set(r.video_id, { aberto: true, ate: retomarAPartirDe({ primeiraVista: r.primeira_vista, confirmadoEm: r.confirmado_em, createdAt: r.created_at }).toISOString() })
  }
  for (const t of alvo) saida.set(t.id, porVideo.get(t.youtube_video_id as string) ?? { aberto: false, ate: null })
  return saida
}
