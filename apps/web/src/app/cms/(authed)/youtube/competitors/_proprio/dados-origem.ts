// A5 · E5b · Tarefa 9: a entrada da origem das views do canal ou do vídeo próprio (servidor).
// Lê as dimensões em trechos de até 120 dias e lotes de até 50 vídeos (no máximo 12 chamadas, 2 em voo) e os DOIS diários da origem
// (o do período curto mais largo e o inteiro, de onde sai o total de "Desde ..."). Sem prova de leitura: `negado`, sem criar o
// cliente de serviço. Erro de qualquer trecho: `{ acesso: 'erro' }` e UM aviso ao Sentry, sem conteúdo do banco.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import { getSupabaseServiceClient } from '@/lib/supabase/service'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import { mapLimit } from '@/lib/youtube/observatorio/load'
import { CONJUNTOS_DIMENSOES } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import { leituraValida, type LeituraPrivadaDoSite } from '@/lib/youtube/observatorio/proprio/leitura-privada'
import { ErroLeituraDimensoes, lerDimensoes, type DimensoesCanal } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import { lerDiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/ler-diario-periodo'
import type { DiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/diario-periodo'
import type { DiaYt, Privado } from '@/lib/youtube/observatorio/proprio/tipos'
import { CHAMADAS_EM_VOO, chamadasDe, juntarConjunto, juntarDiarios, lotesDe } from './origem-trechos'

export interface OrigemLida {
  dimensoes: DimensoesCanal
  /** de `diarioDesde` a `ate` */
  diario: DiarioDoPeriodo
  /** o diário desde o começo (de nulo); nulo quando a leitura falhou ou passou do teto: o total do período longo lê "não medido" */
  diarioInteiro: DiarioDoPeriodo | null
  trechos: number
}

const TAGS = { component: 'observatorio-proprio', step: 'ler-origem' } as const

/** Um aviso, sem conteúdo do banco: só o motivo e o código. */
export function avisarFalhaDeLeitura(step: string, e: unknown): void {
  const motivo = e instanceof ErroLeituraDimensoes ? e.motivo : e instanceof RangeError ? 'janela_ou_chamadas' : 'inesperado'
  const codigo = e instanceof ErroLeituraDimensoes ? e.codigo : typeof (e as { code?: unknown } | null)?.code === 'string' ? (e as { code: string }).code : null
  Sentry.captureMessage('observatório: a leitura da origem do canal próprio falhou', { level: 'warning', tags: { ...TAGS, step }, extra: { motivo, codigo } })
}

export async function lerOrigem(a: {
  canalId: string
  ytIds: readonly string[]
  /** a janela das dimensões */
  de: DiaYt
  ate: DiaYt
  /** o primeiro dia do período curto mais largo (`ate - 89` no canal, `ate - 6` no vídeo) */
  diarioDesde: DiaYt
  /** a publicação de cada vídeo (a cobertura de cada um começa nela) */
  publicacoes: ReadonlyMap<string, DiaYt | null>
  agora: number
  prova: LeituraPrivadaDoSite | null
}): Promise<Privado<OrigemLida>> {
  if (!leituraValida(a.prova)) return { acesso: 'negado' }
  const leitura = a.prova
  const hoje = dayPt(new Date(a.agora))
  try {
    const chamadas = chamadasDe(a.ytIds, a.de, a.ate)
    if (a.diarioDesde > a.ate) throw new RangeError('lerOrigem: diarioDesde depois de ate')
    const sb = getSupabaseServiceClient()
    const base = { leitura, canalId: a.canalId, hoje }
    const lidas = await mapLimit(chamadas, CHAMADAS_EM_VOO, async c => {
      const r = await lerDimensoes(sb, { ...base, ytIds: c.ytIds, de: c.de, ate: c.ate })
      if (r.acesso !== 'ok') throw new ErroLeituraDimensoes('dimensoes-da-origem', 'erro_de_banco', null, 0)
      return { c, dado: r.dado }
    })
    const conjuntos = Object.fromEntries(CONJUNTOS_DIMENSOES.map(k => [k, juntarConjunto(lidas.map(l => ({ trecho: l.c.trecho, lote: l.c.lote, conjunto: l.dado.conjuntos[k] })))])) as DimensoesCanal['conjuntos']
    const dimensoes: DimensoesCanal = { canalId: a.canalId, de: a.de, ate: a.ate, conjuntos, descartados: lidas.reduce((s, l) => s + l.dado.descartados, 0) }
    const lotes = lotesDe(a.ytIds)
    const diarioDe = async (de: DiaYt | null): Promise<DiarioDoPeriodo> => {
      const partes = await mapLimit(lotes, CHAMADAS_EM_VOO, async ytIds => {
        const r = await lerDiarioDoPeriodo(sb, { ...base, ytIds, de, ate: a.ate, soComViews: true, publicacoes: a.publicacoes })
        if (r.acesso !== 'ok') throw new ErroLeituraDimensoes('diario-da-origem', 'erro_de_banco', null, 0)
        return r.dado
      })
      return juntarDiarios(partes)
    }
    const diario = await diarioDe(a.diarioDesde)
    let diarioInteiro: DiarioDoPeriodo | null = null
    try { diarioInteiro = await diarioDe(null) } catch (e) { avisarFalhaDeLeitura('ler-origem-diario-inteiro', e) }
    return { acesso: 'ok', dado: { dimensoes, diario, diarioInteiro, trechos: new Set(chamadas.map(c => c.trecho)).size } }
  } catch (e) {
    avisarFalhaDeLeitura('ler-origem', e)
    return { acesso: 'erro' }
  }
}
