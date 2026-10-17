// E17 d1 (TG): o que a página do canal e o pacote "Perguntar a uma IA" montam IGUAL: a leitura única das medidas e o contexto sem medida.
// Fica aqui para a página e o empacotador nunca divergirem.
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { carregarMedidasDoCanalInteiro, type CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import { contaComoTroca } from '@/lib/youtube/observatorio/changes'
import type { ProvasDeQuemVe } from '@/lib/youtube/observatorio/comentarios/leitor-tipos'
import type { Observatory } from '@/lib/youtube/observatorio'
import type { CanalView } from '../view-model'
import { canalNaoCarregou } from './canal-derivado-async'
import type { ContextoDoCanal } from './canal-derivado'

/** A leitura das medidas do canal; nunca lança (defeito vira "não carregou" e vai ao Sentry). */
export async function lerMedidasDoCanal(c: { pagina: { siteId: string; now: number }; obs: Observatory; view: CanalView }): Promise<CanalInteiro> {
  // `async`: o corpo roda até o primeiro `await` na hora da chamada e nada lança para fora da promessa
  try {
    return await carregarMedidasDoCanalInteiro(getSupabaseServiceClient(), {
      siteId: c.pagina.siteId, obs: c.obs, channelId: c.view.header.id, agoraMs: c.pagina.now, pedir: { serie: true, mudancas: true, horas: true },
    })
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'observatorio-canal', step: 'medidas' } })
    return canalNaoCarregou()
  }
}

/** O que a página já sabe, sem esperar medida: os títulos dos vídeos, as trocas do motor (90 dias), a sincronização e os inscritos. */
export function contextoDoCanal(obs: Observatory, view: CanalView, agoraMs: number, quem: { siteId: string; provas: ProvasDeQuemVe; permissaoFalhou: boolean }): ContextoDoCanal {
  const ch = obs.channel(view.header.id)
  return {
    comentarios: { siteId: quem.siteId, channelId: view.header.id, nome: view.header.name, provas: quem.provas, permissaoFalhou: quem.permissaoFalhou },
    F: obs.fmt, subs: ch?.subs ?? null,
    sync: { state: ch?.sync.state ?? 'ok', last: ch?.sync.last ?? null, errorSince: ch?.sync.errorSince ?? null },
    hojeSP: dayPt(new Date(agoraMs)), agoraMs, primeiraBusca: ch?.sync.state === 'backfill', semVideos: view.videos.videos.length === 0,
    titulos: view.videos.videos.map(v => [v.id, v.title] as const),
    trocas: obs.changesIn({ days: 90, channel: view.header.id }).filter(contaComoTroca).map(c => ({ videoId: c.video, campo: c.type === 'title' ? 'titulo' as const : 'miniatura' as const, emMs: c.at })),
  }
}
