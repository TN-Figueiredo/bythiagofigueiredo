// A5 · E5b · Tarefa 9: o diário de um período e o total que ele sustenta. PURO (sem banco, sem `server-only`): as telas e o modelo importam
// daqui; o leitor que consulta o banco é `ler-diario-periodo.ts`, que as páginas não podem importar (varredura).
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { quemEstaNaConta } from './na-conta'
import type { DiaYt } from './tipos'

const NUNCA: DiaYt = '0001-01-01'

export interface IntervaloBase { de: DiaYt; ate: DiaYt }
export interface DiarioPeriodoLinha { ytId: string; dia: DiaYt; views: number | null; pctAssistido: number | null }
export interface CoberturaDoPeriodo {
  conhecida: boolean
  videosCompletos: number
  videosIncompletos: number
  primeiroDiaLido: DiaYt | null
  /** os intervalos `base` por vídeo (cada vídeo lido tem chave, mesmo sem intervalo): o total de qualquer trecho da leitura sai daqui */
  intervalos: ReadonlyMap<string, ReadonlyArray<IntervaloBase>>
  /** os vídeos efetivamente lidos (sem os de `foraDoTeto`) e a publicação de cada um, para `totalDoPeriodo` */
  ytIds: readonly string[]
  publicacoes: ReadonlyMap<string, DiaYt | null>
}
export interface DiarioDoPeriodo {
  canalId: string
  de: DiaYt | null
  ate: DiaYt
  linhas: DiarioPeriodoLinha[]
  foraDoTeto: readonly string[]
  descartados: number
  cobertura: CoberturaDoPeriodo
}

/** Os intervalos (ordenados por início) cobrem todos os dias de `de` a `ate`? `de > ate` não exige nada. */
export function cobreTodo(intervalos: ReadonlyArray<IntervaloBase>, de: DiaYt, ate: DiaYt): boolean {
  if (de > ate) return true
  let falta = de
  for (const iv of [...intervalos].sort((a, b) => (a.de < b.de ? -1 : a.de > b.de ? 1 : 0))) {
    if (iv.de > falta) return false
    if (iv.ate >= falta) falta = addDays(iv.ate, 1)
    if (falta > ate) return true
  }
  return falta > ate
}

export interface TotalDoPeriodo {
  total: number | null
  videosNaConta: number
  videosFora: number
  videosParados: number
  paradosDesde: DiaYt | null
  comBuraco: number
}

/**
 * O total de views de `[de, ate]` (`de` nulo = desde a publicação de cada vídeo) com a regra de `quemEstaNaConta`: vídeo sem nenhum dia
 * coberto no trecho é `fora`; vídeo com a cobertura parada há mais de 8 dias é exigido só até o último dia coberto. `comBuraco` conta os
 * vídeos da conta com algum dia sem cobertura entre `max(de, publicação)` e o seu `exigidoAte` (publicação nula conta como buraco).
 * `total` é NULO com a cobertura desconhecida, com `comBuraco > 0`, com vídeos além do teto ou sem nenhum vídeo na conta; nunca 0 por falta de dado.
 */
export function totalDoPeriodo(d: DiarioDoPeriodo, p: { de: DiaYt | null; ate: DiaYt }): TotalDoPeriodo {
  const vazio: TotalDoPeriodo = { total: null, videosNaConta: 0, videosFora: 0, videosParados: 0, paradosDesde: null, comBuraco: 0 }
  if (!d.cobertura.conhecida) return vazio
  const de = p.de ?? NUNCA
  const ultimoMedido = (id: string): DiaYt | null => {
    let ultimo: DiaYt | null = null
    for (const iv of d.cobertura.intervalos.get(id) ?? []) {
      const fim = iv.ate < p.ate ? iv.ate : p.ate
      const ini = iv.de > de ? iv.de : de
      if (ini <= fim && (ultimo === null || fim > ultimo)) ultimo = fim
    }
    return ultimo
  }
  // vídeo publicado depois do fim do período ainda não existia: não é "fora" (todo upload passaria por esse estado até o diário alcançá-lo)
  const ytIds = d.cobertura.ytIds.filter(id => { const pub = d.cobertura.publicacoes.get(id) ?? null; return pub === null || pub <= p.ate })
  const conta = quemEstaNaConta({ ytIds, de, ate: p.ate, ultimoMedido })
  const somaPorVideo = new Map<string, number>()
  let comValorDescartado = false
  for (const l of d.linhas) {
    const ate = conta.exigidoAte.get(l.ytId)
    if (ate === undefined || l.dia > ate || l.dia > p.ate || (p.de !== null && l.dia < p.de)) continue
    if (l.views === null) comValorDescartado = true // views ilegível (negativa virou nulo): somar como 0 afirmaria um total menor
    somaPorVideo.set(l.ytId, (somaPorVideo.get(l.ytId) ?? 0) + (l.views ?? 0))
  }
  let comBuraco = 0, total = 0
  for (const [id, exigidoAte] of conta.exigidoAte) {
    const pub = d.cobertura.publicacoes.get(id) ?? null
    const inicio = pub === null ? null : p.de === null ? pub : pub > p.de ? pub : p.de
    if (inicio === null || !cobreTodo(d.cobertura.intervalos.get(id) ?? [], inicio, exigidoAte)) comBuraco++
    total += somaPorVideo.get(id) ?? 0
  }
  const out = { videosNaConta: conta.exigidoAte.size, videosFora: conta.fora.length, videosParados: conta.parados.length, paradosDesde: conta.paradosDesde, comBuraco }
  return { ...out, total: comBuraco > 0 || comValorDescartado || conta.exigidoAte.size === 0 || d.foraDoTeto.length > 0 ? null : total }
}
