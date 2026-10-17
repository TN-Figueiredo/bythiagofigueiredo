import 'server-only'
// A5 · E5a, Tarefa 10a: a leitura do servidor para o bloco "Estourou e parou". Arquivo à parte de `_historico/` porque o teste da tela
// proíbe que os componentes dali importem o motor (desvio declarado no relatório da tarefa).
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Sentry from '@sentry/nextjs'
import { carregarMedidasDoSite, type IObservatorioDeMedidas, type MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { aindaNaoExiste } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { spDateOf } from '@/lib/youtube/observatorio/time'
import type { MedidasDoVideo } from '@/lib/youtube/observatorio/medidas/do-canal'
import { leituraDoVideo, type Leitura } from './estourou-model'

/** O pedaço do `Observatory` de que a leitura precisa: o vídeo e o canal dele, e o que o carregador das medidas pede. */
export interface IObservatorioDaLeitura extends IObservatorioDeMedidas {
  video(id: string): { id: string; ch: string; ageDays: number } | undefined
  channel(id: string): { id: string; name: string; own: boolean } | undefined
}

/**
 * O que se sabe SEM consultar nada. Nulo: o vídeo não é do site, ou é de canal próprio (o bloco nem existe). `'ler'`: depois da data, a leitura
 * precisa do servidor. Uma leitura pronta: antes da data em que ela passa a existir (nada é pedido, e a página nem precisa de `Suspense`).
 * O id é cruzado com `obs.video` ANTES de qualquer consulta.
 */
export function leituraSemConsulta(obs: Pick<IObservatorioDaLeitura, 'video' | 'channel'>, videoId: string, now: number): Leitura | 'ler' | null {
  const v = obs.video(videoId)
  if (!v) return null
  const canal = obs.channel(v.ch)
  if (!canal || canal.own) return null
  const hojeSP = spDateOf(now)
  if (aindaNaoExiste('estourou', hojeSP)) return leituraDoVideo(null, null, hojeSP, { idadeDias: Math.max(0, Math.floor(v.ageDays)), canal: canal.name })
  return 'ler'
}

/**
 * Lê a leitura de UM vídeo. Nunca lança: qualquer falha vira "não carregou" (e vai ao Sentry), nunca "não é o caso".
 * O id da URL é cruzado com `obs.video` ANTES de qualquer consulta: vídeo que não é do site, ou de canal próprio, não lê nada.
 * Antes da data em que a leitura passa a existir nada é pedido. Depois, UMA chamada ao motor por vídeo: a série diária deste vídeo só é pedida
 * se ele tem 90 dias ou mais (menos que isso não paga a série).
 */
export async function lerLeituraDoVideo(p: {
  sb: SupabaseClient; siteId: string; obs: IObservatorioDaLeitura; videoId: string; now: number
  carregar?: typeof carregarMedidasDoSite
}): Promise<Leitura | null> {
  const antes = leituraSemConsulta(p.obs, p.videoId, p.now)
  if (antes !== 'ler') return antes
  const v = p.obs.video(p.videoId)!
  const canal = p.obs.channel(v.ch)!
  const hojeSP = spDateOf(p.now)
  const video = { idadeDias: Math.max(0, Math.floor(v.ageDays)), canal: canal.name }
  const carregar = p.carregar ?? carregarMedidasDoSite
  const doVideo = (m: MedidasDoSite): MedidasDoVideo | null => {
    const c = m.porCanal.get(canal.id)
    return c && !('naoCarregou' in c) ? (c.porVideo.get(v.id) ?? null) : null
  }
  try {
    const base = { siteId: p.siteId, obs: p.obs, canais: [canal.id], agoraMs: p.now }
    // UMA chamada ao motor por vídeo: com 90 dias ou mais a série diária deste vídeo (e só dele) vem junto; com menos, nem é pedida
    const comSerie = video.idadeDias >= MEASURE_RULES.tail.minAgeDays
    const mv = doVideo(await carregar(p.sb, comSerie ? { ...base, seriesDe: new Map([[canal.id, [v.id]]]) } : base))
    const ar = comSerie ? mv?.m9.aindaRende : undefined
    // série pedida e não lida: o motor devolve "série incompleta", que é um motivo de verdade; aqui é falha de leitura
    if (ar && ar.estado === 'nao_medido' && (ar.motivo === 'leitura_falhou' || ar.motivo === 'serie_nao_pedida' || ar.motivo === 'calculo_falhou')) {
      // só o motivo no agrupamento: nem id nem título
      Sentry.captureMessage('observatório: série do vídeo não lida (estourou-e-parou)', {
        level: 'warning', fingerprint: ['medidas-telas', 'estourou-serie', ar.motivo], tags: { component: 'observatorio', step: 'estourou-e-parou' },
      })
      return leituraDoVideo(null, null, hojeSP, video)
    }
    if (!mv) return leituraDoVideo(null, null, hojeSP, video)
    // "sem reação pública" com a reação que falhou ao ser calculada não é "curtidas ocultas": é leitura que não carregou
    if (mv.m10.estado === 'nao_medido' && mv.m10.motivo === 'sem_reacao_publica' && mv.m7.estado === 'nao_medido' && (mv.m7.motivo === 'leitura_falhou' || mv.m7.motivo === 'calculo_falhou')) {
      return leituraDoVideo(null, null, hojeSP, video)
    }
    return leituraDoVideo(mv.m10, mv.m1[30], hojeSP, video)
  } catch (err) {
    Sentry.captureException(err, { tags: { component: 'observatorio', step: 'estourou-e-parou' } })
    return leituraDoVideo(null, null, hojeSP, video)
  }
}

