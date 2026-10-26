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
import { canalDerivadoDe, canalNaoCarregou } from './canal-derivado-async'
import { lerComentariosDoCanal, type ComentariosDoCanal } from './comentarios-do-canal'
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
    ...(obs.ONLINE_DESDE ? { arquivo: { lido: obs.ONLINE_DESDE.lido, horasDesde: obs.ONLINE_DESDE.lido ? obs.ONLINE_DESDE.porTabela.competitor_video_hourly : null } } : {}),
    F: obs.fmt, subs: ch?.subs ?? null,
    sync: { state: ch?.sync.state ?? 'ok', last: ch?.sync.last ?? null, errorSince: ch?.sync.errorSince ?? null },
    hojeSP: dayPt(new Date(agoraMs)), agoraMs, primeiraBusca: ch?.sync.state === 'backfill', semVideos: view.videos.videos.length === 0,
    titulos: view.videos.videos.map(v => [v.id, v.title] as const),
    thumbs: view.videos.videos.map(v => [v.id, v.ytId ? `https://i.ytimg.com/vi/${encodeURIComponent(v.ytId)}/mqdefault.jpg` : null] as const),
    criador: { nome: view.header.name, avatar: view.header.avatar, ini: view.header.ini, color: view.header.color },
    trocas: obs.changesIn({ days: 90, channel: view.header.id }).filter(contaComoTroca).map(c => ({ videoId: c.video, campo: c.type === 'title' ? 'titulo' as const : 'miniatura' as const, emMs: c.at })),
  }
}

/** A leitura dos comentários do canal que a página faz (uma vez por promessa de medidas); nula quando o contexto não traz o que ler. Nunca lança. */
export async function lerComentariosDoCanalParaOPacote(medidas: Promise<CanalInteiro>, contexto: ContextoDoCanal): Promise<ComentariosDoCanal | null> {
  const k = contexto.comentarios
  if (!k) return null
  const { c, d } = await canalDerivadoDe(medidas, contexto)
  return lerComentariosDoCanal(medidas, c, k, { formato: d.formato, agoraMs: contexto.agoraMs })
}
