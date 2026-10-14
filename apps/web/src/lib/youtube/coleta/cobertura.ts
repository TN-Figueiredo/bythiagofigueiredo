// Leitura da cobertura do diário por vídeo (`yt_own_video_coverage`, MG14), conjunto `base`.
// Depois da dieta (E6) o diário guarda só os dias com atividade; é a cobertura que diz "este dia foi coletado".
// Dia sem linha no diário e DENTRO da cobertura = zero medido; FORA dela = não medido. Por isso a leitura não pode
// errar em silêncio: tabela ausente, erro, resposta sem lista, linha estranha e leitura cortada são resultados
// distintos de "nenhum vídeo coberto", e nenhum deles vira mapa vazio.
// Sem `server-only` e sem importar o Observatório: é um utilitário puro da coleta.

import { lerPaginado } from './paginar'
import { addDays, dayPt, type DiaPt } from './day-pt'
import { ehSchemaAusente, type ErroBanco } from './schema'
import type { ColetaChannel, StepCtx } from './types'

/** Teto de intervalos `base` lidos por canal (35 vídeos hoje, com folga). Passou disso, a leitura falha. */
export const TETO_COBERTURA = 5000

export interface CoberturaDoVideo {
  /** O maior `covered_to` do vídeo no conjunto `base`. */
  ate: DiaPt
  /** O `collected_at` mais recente entre os intervalos do vídeo (a fila da coleta ordena por ele). */
  coletadoEm: string
  /** Quantos intervalos `base` o vídeo tem; mais de um = há buraco. */
  intervalos: number
}

export type ResultadoCobertura = 'schema_ausente' | 'erro' | Map<string, CoberturaDoVideo>

interface LinhaCobertura {
  youtube_video_id: unknown
  covered_to: unknown
  collected_at: unknown
}

const DIA_ISO = /^\d{4}-\d{2}-\d{2}$/

/**
 * Lê a cobertura `base` do canal, uma vez, e devolve por vídeo o maior dia coberto.
 * `'schema_ausente'`: a tabela não existe (a MG14 não foi aplicada). `'erro'`: qualquer outra falha (banco, resposta sem
 * lista, linha com campo nulo ou em forma estranha, mais de 5.000 intervalos). Só o corte em 5.000 anota em `ctx.falhas`
 * (`diário: cobertura de <canal> cortada em 5000`); as demais notas são de quem chama, que sabe o que está avaliando.
 */
export async function lerCoberturaBase(
  ctx: Pick<StepCtx, 'supabase' | 'falhas'>,
  canal: Pick<ColetaChannel, 'id' | 'site_id' | 'name'>,
): Promise<ResultadoCobertura> {
  let ultimoErro: ErroBanco | null = null
  let leitura: Awaited<ReturnType<typeof lerPaginado<LinhaCobertura>>>
  try {
    leitura = await lerPaginado<LinhaCobertura>(async (de, ate) => {
      const res = await ctx.supabase
        .from('yt_own_video_coverage')
        .select('youtube_video_id, covered_to, collected_at')
        .eq('site_id', canal.site_id)
        .eq('channel_id', canal.id)
        .eq('metric_set', 'base')
        // Chave única (vídeo, conjunto, início): sem desempate total o `.range` repete e perde linhas entre páginas.
        .order('youtube_video_id', { ascending: true })
        .order('covered_from', { ascending: true })
        .range(de, ate)
      ultimoErro = res.error ?? ultimoErro
      return { data: res.data as LinhaCobertura[] | null, error: res.error }
    }, TETO_COBERTURA)
  } catch {
    return 'erro'
  }

  if (!leitura.ok) {
    if (leitura.motivo === 'passou_do_teto') {
      ctx.falhas.push(`diário: cobertura de ${canal.name} cortada em ${TETO_COBERTURA}`)
      return 'erro'
    }
    return ehSchemaAusente(ultimoErro) ? 'schema_ausente' : 'erro'
  }

  const porVideo = new Map<string, CoberturaDoVideo>()
  for (const l of leitura.linhas) {
    const id = l.youtube_video_id
    const ate = l.covered_to
    const coletadoEm = l.collected_at
    // Nulo nunca vira zero nem "sem cobertura": uma linha ilegível deixaria o vídeo parecer nunca coletado.
    if (typeof id !== 'string' || id === '') return 'erro'
    if (typeof ate !== 'string' || !DIA_ISO.test(ate)) return 'erro'
    if (typeof coletadoEm !== 'string' || Number.isNaN(Date.parse(coletadoEm))) return 'erro'
    const atual = porVideo.get(id)
    if (!atual) {
      porVideo.set(id, { ate, coletadoEm, intervalos: 1 })
      continue
    }
    atual.intervalos++
    if (ate > atual.ate) atual.ate = ate
    if (Date.parse(coletadoEm) > Date.parse(atual.coletadoEm)) atual.coletadoEm = coletadoEm
  }
  return porVideo
}

/**
 * Primeiro dia que o diário pede à Analytics API para um vídeo.
 * Com cobertura: o menor entre `hoje − 10` (os últimos dias ainda mudam) e o último dia coberto (se a cobertura parou,
 * recomeça de onde parou). Sem cobertura: o dia da publicação no Pacífico. Nunca depois de `hoje`.
 */
export function inicioDaJanela(o: { hoje: DiaPt; cobertoAte: DiaPt | null; publicadoEm: string }): DiaPt {
  const recente = addDays(o.hoje, -10)
  const inicio = o.cobertoAte !== null
    ? (o.cobertoAte < recente ? o.cobertoAte : recente)
    : dayPt(new Date(o.publicadoEm))
  return inicio > o.hoje ? o.hoje : inicio
}
