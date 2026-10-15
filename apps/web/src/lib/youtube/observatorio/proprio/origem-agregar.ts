/**
 * Agregação por período e estado por bloco das telas de origem (plano E5b, Tarefa 8b; mockup 12). Puro: o dia de hoje entra por parâmetro.
 *
 * Regras (as do plano):
 *  1. Dia medido é o dia INTEIRO: todos os vídeos exigidos naquele dia têm o conjunto coberto, a referência medida e nenhuma contagem nula.
 *     Quem é exigido vem de `quemEstaNaConta` (fora, parado, na conta). Dia em que nenhum vídeo é exigido não é medido.
 *  2. Uma célula em revisão (soma das linhas acima da referência) em dia medido põe o bloco inteiro em revisão, sem divisão.
 *  3. Total = soma da referência nos dias medidos; soma = soma das linhas; valorNaoCatalogado = views de valores que o catálogo não conhece
 *     (chave nula ou fora da ordem fixa); omitido = total - soma - valorNaoCatalogado, nunca negativo. Fecho: total = soma + omitido + valorNaoCatalogado.
 *  4. Sem dia medido: "não medido" com o motivo. Com o conjunto coletado o motivo é SEMPRE `cobertura_parcial`, nunca `coleta_nao_comecou`
 *     (sem nenhum vídeo no período: `ainda_nao_existe`).
 * "Não medido" nunca vira zero.
 */
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { DiaLido, EstadoConjunto, LinhaBasica } from './dimensoes-estado'
import { estadoDoDia } from './dimensoes-estado'
import type { ConjuntoLido } from './ler-dimensoes'
import type { MotivoNaoMedido } from './motivos-nao-medido'
import { quemEstaNaConta } from './na-conta'
import type { DiaYt } from './tipos'

/** O dia em que a contagem das views muda de regra (pergunta 10 do plano; o mockup escreve 24/08/2026). */
export const MARCA_DE_CONTAGEM: DiaYt = '2026-08-24'

export type EstadoBloco = 'medido' | 'zero' | 'nao_medido' | 'em_revisao'

export interface Cobertura {
  dias: number
  medidos: number
  de: DiaYt
  ate: DiaYt
  primeiroMedido: DiaYt | null
  ultimoMedido: DiaYt | null
  /** a data de partida do conjunto (a menor que o leitor trouxe) */
  desde: DiaYt | null
  cruzaMarca: boolean
  /** os dias medidos, em ordem (para `diasMedidosEmComum`) */
  diasMedidosLista: readonly DiaYt[]
}

export interface LinhaBloco<K extends string> { chave: K; valor: number; pct: number; semNumero: boolean }

export interface BlocoAgregado<K extends string> {
  estado: EstadoBloco
  motivo: MotivoNaoMedido | null
  conjunto: EstadoConjunto
  cobertura: Cobertura
  total: number
  soma: number
  omitido: number
  pctOmitido: number
  /** as views de valores que o catálogo não conhece: não entram na soma nem no omitido do YouTube */
  valorNaoCatalogado: number
  pctNaoCatalogado: number
  linhas: LinhaBloco<K>[]
  naoCatalogados: number
  diasEmRevisao: number
  videosNaConta: number
  videosFora: number
  faltamNoPiorDia: number
  videosParados: number
  paradosDesde: DiaYt | null
}

/** Inteiros que somam 100 pelo método do maior resto (empate fica com o primeiro). Lista vazia ou soma 0: zeros. */
export function maiorResto(valores: readonly number[]): number[] {
  const total = valores.reduce((s, v) => s + v, 0)
  if (valores.length === 0 || !(total > 0)) return valores.map(() => 0)
  const base = valores.map(v => Math.floor((v * 100) / total))
  let falta = 100 - base.reduce((s, v) => s + v, 0)
  const ordem = valores.map((v, i) => ({ i, resto: (v * 100) % total })).sort((a, b) => b.resto - a.resto || a.i - b.i)
  for (const { i } of ordem) {
    if (falta <= 0) break
    base[i] = (base[i] as number) + 1
    falta--
  }
  return base
}

/** "<1%" quando há valor e a porcentagem arredondou a 0; nunca "0%" para quem tem número. */
export function pctTexto(pct: number, valor: number): string {
  return valor > 0 && pct === 0 ? '<1%' : `${pct}%`
}

/** Os dois blocos cobrem exatamente os mesmos dias medidos? */
export function diasMedidosEmComum(a: Cobertura, b: Cobertura): boolean {
  return a.diasMedidosLista.length === b.diasMedidosLista.length && a.diasMedidosLista.every((d, i) => d === b.diasMedidosLista[i])
}

const CONJUNTOS_DE_LOTE: readonly string[] = ['detalhe', 'alcance_dim']

const medidoNoDia = (dl: DiaLido<LinhaBasica>): boolean => dl.coberto && dl.baseMedida && !dl.antesDoInicio

/** Os períodos da tela são 7, 28 e 90 dias; 400 é o teto do leitor. Acima disso lança (cortar em silêncio faria `cobertura.dias` mentir). */
export const TETO_DIAS_DO_PERIODO = 400

function intervalo(de: DiaYt, ate: DiaYt): DiaYt[] {
  const out: DiaYt[] = []
  for (let x = de; x <= ate; x = addDays(x, 1)) {
    if (out.length >= TETO_DIAS_DO_PERIODO) throw new RangeError(`agregarBloco: período acima de ${TETO_DIAS_DO_PERIODO} dias (${de} a ${ate})`)
    out.push(x)
  }
  return out
}

/** Sem `resto`, `maxLinhas` cortaria linhas e sumiria com o valor delas: o compilador proíbe o caso. */
type Ordem<K extends string> =
  | { ordem: readonly K[]; maxLinhas?: undefined; resto?: undefined }
  | { ordem: 'por-valor'; maxLinhas?: undefined; resto?: undefined }
  | { ordem: 'por-valor'; maxLinhas: number; resto: K }

export function agregarBloco<K extends string>(p: {
  conjunto: ConjuntoLido<LinhaBasica>
  de: DiaYt
  ate: DiaYt
  /** o dia de hoje (dia do YouTube): decide "a coleta começa em" contra "a coleta não começou" */
  hoje: DiaYt
  publicacoes: ReadonlyMap<string, DiaYt | null>
  chaveDe(valor: string): { chave: K; catalogado: boolean } | null
} & Ordem<K>): BlocoAgregado<K> {
  const { conjunto, de, ate } = p
  const dias = intervalo(de, ate)
  const porVideo = new Map<string, Map<DiaYt, DiaLido<LinhaBasica>>>()
  let desde: DiaYt | null = null
  for (const v of conjunto.videos) {
    const m = porVideo.get(v.ytId) ?? new Map<DiaYt, DiaLido<LinhaBasica>>()
    for (const dl of v.dias) {
      m.set(dl.dia, dl)
      if (dl.desde != null && (desde == null || dl.desde < desde)) desde = dl.desde
    }
    porVideo.set(v.ytId, m)
  }
  // vídeo publicado depois de `ate` ainda não existia no período: não é "fora"
  const ytIds = [...new Set([...porVideo.keys(), ...p.publicacoes.keys()])].filter(id => { const pub = p.publicacoes.get(id) ?? null; return pub === null || pub <= ate })

  const ultimoMedido = (id: string): DiaYt | null => {
    const m = porVideo.get(id)
    if (!m) return null
    let ultimo: DiaYt | null = null
    for (const [dia, dl] of m) if (dia >= de && dia <= ate && medidoNoDia(dl) && (ultimo == null || dia > ultimo)) ultimo = dia
    return ultimo
  }
  const naConta = quemEstaNaConta({ ytIds, de, ate, ultimoMedido })

  let total = 0
  let soma = 0
  let naoCatalogados = 0
  let valorNaoCatalogado = 0
  let diasEmRevisao = 0
  let faltamNoPiorDia = 0
  const medidos: DiaYt[] = []
  const porChave = new Map<K, number>()
  for (const dia of dias) {
    const exigidos: Array<DiaLido<LinhaBasica> | null> = []
    for (const [id, exigidoAte] of naConta.exigidoAte) {
      const pub = p.publicacoes.get(id) ?? null
      if (dia > exigidoAte || (pub != null && pub > dia)) continue
      exigidos.push(porVideo.get(id)?.get(dia) ?? null)
    }
    if (exigidos.length === 0) continue
    const bons = exigidos.filter((dl): dl is DiaLido<LinhaBasica> => dl != null && medidoNoDia(dl) && !dl.linhas.some(l => l.views === null))
    faltamNoPiorDia = Math.max(faltamNoPiorDia, exigidos.length - bons.length)
    if (bons.length !== exigidos.length) continue
    medidos.push(dia)
    if (bons.some(dl => estadoDoDia(dl).emRevisao)) diasEmRevisao++
    for (const dl of bons) {
      total += dl.base ?? 0
      for (const l of dl.linhas) {
        const k = p.chaveDe(l.valor)
        const fixa = p.ordem !== 'por-valor' && k != null && !(p.ordem as readonly K[]).includes(k.chave)
        if (k == null || fixa) { naoCatalogados++; valorNaoCatalogado += l.views ?? 0; continue }
        if (!k.catalogado) naoCatalogados++
        const v = l.views ?? 0
        soma += v
        porChave.set(k.chave, (porChave.get(k.chave) ?? 0) + v)
      }
    }
  }
  if (naConta.exigidoAte.size === 0) faltamNoPiorDia = naConta.fora.length

  const cobertura: Cobertura = {
    dias: dias.length, medidos: medidos.length, de, ate,
    primeiroMedido: medidos[0] ?? null, ultimoMedido: medidos[medidos.length - 1] ?? null,
    desde, cruzaMarca: de < MARCA_DE_CONTAGEM && MARCA_DE_CONTAGEM <= ate, diasMedidosLista: medidos,
  }

  // as linhas: ordem fixa (toda chave aparece, mesmo com 0) ou por valor (as maiores e o resto somado)
  let chaves: Array<[K, number]>
  if (p.ordem === 'por-valor') {
    const ordenado = [...porChave.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    if (p.maxLinhas != null && ordenado.length > p.maxLinhas) {
      const resto = ordenado.slice(p.maxLinhas).reduce((s, [, v]) => s + v, 0)
      chaves = [...ordenado.slice(0, p.maxLinhas), [p.resto, resto]]
    } else chaves = p.maxLinhas != null ? ordenado.slice(0, p.maxLinhas) : ordenado
  } else chaves = p.ordem.map((k): [K, number] => [k, porChave.get(k) ?? 0])

  const omitido = Math.max(0, total - soma - valorNaoCatalogado)
  const pcts = maiorResto([...chaves.map(([, v]) => v), omitido, valorNaoCatalogado])
  const linhas: LinhaBloco<K>[] = chaves.map(([chave, valor], i) => ({ chave, valor, pct: pcts[i] as number, semNumero: valor === 0 && omitido > 0 }))
  const pctOmitido = pcts[pcts.length - 2] as number
  const pctNaoCatalogado = pcts[pcts.length - 1] as number

  let estado: EstadoBloco
  let motivo: MotivoNaoMedido | null = null
  if (medidos.length === 0) {
    estado = 'nao_medido'
    motivo = motivoSemMedidos(conjunto, ytIds.length > 0, desde, p.hoje)
  } else if (diasEmRevisao > 0) estado = 'em_revisao'
  else estado = total === 0 ? 'zero' : 'medido'

  return {
    estado, motivo, conjunto: conjunto.estado, cobertura, total, soma, omitido, pctOmitido, valorNaoCatalogado, pctNaoCatalogado,
    linhas: estado === 'em_revisao' || estado === 'nao_medido' ? [] : linhas,
    naoCatalogados, diasEmRevisao, videosNaConta: naConta.exigidoAte.size, videosFora: naConta.fora.length,
    faltamNoPiorDia, videosParados: naConta.parados.length, paradosDesde: naConta.paradosDesde,
  }
}

function motivoSemMedidos(c: ConjuntoLido<LinhaBasica>, temVideos: boolean, desde: DiaYt | null, hoje: DiaYt): MotivoNaoMedido {
  const e = c.estado
  switch (e.tipo) {
    case 'passo_desligado': return 'coleta_desligada'
    case 'coleta_em_erro': return 'busca_falhou'
    case 'nao_coletado':
      if (CONJUNTOS_DE_LOTE.includes(c.conjunto)) return 'relatorio_nao_chegou'
      return desde != null && desde > hoje ? 'coleta_comeca_em' : 'coleta_nao_comecou'
    case 'schema_ausente':
      return desde != null && desde > hoje ? 'coleta_comeca_em' : 'coleta_nao_comecou'
    case 'coletado':
      // a coleta roda e nenhum dia tem todos os vídeos medidos: nunca "a coleta não começou"
      return temVideos ? 'cobertura_parcial' : 'ainda_nao_existe'
    default: {
      const _nunca: never = e
      return _nunca
    }
  }
}
