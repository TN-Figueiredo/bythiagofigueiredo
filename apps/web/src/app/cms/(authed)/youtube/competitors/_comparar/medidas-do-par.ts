/**
 * A5 E5a T7 (tela 17a): o que as medidas novas acrescentam ao par: o estado de cada lado (M8), o grupo Direção, os primeiros dias (M1),
 * o acerto (M4) e a reação do público (M7). PURO, roda no navegador sobre o pacote. `null` = o pacote foi montado sem as medidas
 * (nada novo aparece). Não toca em `buildPar`: as treze linhas antigas seguem como estavam.
 */
import { fraseDasPrimeiras24h, primeiras24hDesde } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { medidasDoLado, type CelulaAcerto, type CelulaNumero, type CelulaReacao, type LadoMedidas } from './medidas-do-lado'
import { grupoDeDirecao, type GrupoDeDirecao } from './direcao-model'
import { relacaoDoPar, type RelacaoNova } from './relacao-do-par'
import type { CompararPack } from './pack'

export const TEXTO_LEITURAS_DIFERENTES = 'Leituras diferentes: não dá para dizer qual é maior.'

export interface LinhaDePrimeirosDias {
  idade: 1 | 7 | 30
  titulo: string
  sub: string
  lados: [CelulaNumero, CelulaNumero]
  /** Larguras 0 a 1 na MESMA escala dos dois lados (null = lado sem medida: a barra vira "não medido"). */
  barras: [number | null, number | null] | null
  relacao: RelacaoNova | null
}

export interface LinhaDeReacao {
  lados: [CelulaReacao, CelulaReacao]
  /** "≠ Leituras diferentes": idades (30 dias × total de hoje) ou componentes (curtidas e comentários × só curtidas) diferentes. */
  diferentes: boolean
  relacao: RelacaoNova | null
}

export interface MedidasDoPar {
  hojeSP: string
  lados: [LadoMedidas, LadoMedidas]
  /** Lado cujos números não carregaram (um só: com os dois, a tela diz dos dois). */
  semCarregar: Array<{ lado: 'A' | 'B'; nome: string }>
  direcao: GrupoDeDirecao
  primeiros: { fraseDaData: string; linhas: LinhaDePrimeirosDias[] }
  acerto: { lados: [CelulaAcerto, CelulaAcerto]; nota: string | null }
  reacao: LinhaDeReacao
  nichosDiferentes: boolean
  /** Nenhum dos dois lados é canal seu: uma linha quieta diz por que não há o cartão "Só o seu canal mede". */
  semCanalProprio: boolean
  /** "Só de contexto: …" ou, nos nichos diferentes, a frase da régua. Nulo com um lado sem carregar. */
  contexto: string | null
}

/** Nulo quando o pacote não traz as medidas novas. */
export function buildMedidasDoPar(pack: CompararPack, idA: string, idB: string): MedidasDoPar | null {
  const hojeSP = pack.hojeSP
  if (hojeSP === undefined) return null
  const a = pack.canais.find(c => c.id === idA), b = pack.canais.find(c => c.id === idB)
  if (!a || !b) return null
  const la = medidasDoLado(a, hojeSP), lb = medidasDoLado(b, hojeSP)
  const nomes: readonly [string, string] = [a.name, b.name]
  const ate = la.ate ?? lb.ate

  const barras = (xa: number | null, xb: number | null): [number | null, number | null] | null => {
    if (xa === null && xb === null) return null
    const m = Math.max(xa ?? 0, xb ?? 0) || 1
    return [xa === null ? null : Math.max(0.03, xa / m), xb === null ? null : Math.max(0.03, xb / m)]
  }
  const x = (c: CelulaNumero): number | null => (c.tipo === 'medido' ? c.x : null)
  const idades = [
    [1, 'Primeiras 24 horas', primeiras24hDesde() ? fraseDasPrimeiras24h() : 'só vídeos publicados depois da data do envio'],
    [7, 'Primeiros 7 dias', 'mediana dos longos com 7 dias de contagem'],
    [30, 'Primeiros 30 dias', 'mediana dos longos com 30 dias de contagem'],
  ] as const
  const noun = { 1: 'views nas primeiras 24 horas', 7: 'views em 7 dias', 30: 'views em 30 dias' } as const
  const linhasM1: LinhaDePrimeirosDias[] = idades.map(([idade, titulo, sub]) => {
    const ca = la.m1[idade], cb = lb.m1[idade]
    return {
      idade, titulo, sub, lados: [ca, cb], barras: la.naoCarregou || lb.naoCarregou ? null : barras(x(ca), x(cb)),
      relacao: la.naoCarregou || lb.naoCarregou ? null : relacaoDoPar(x(ca), x(cb), nomes, { art: 'as', noun: noun[idade], ate }),
    }
  })

  const ra = la.reacao, rb = lb.reacao
  const ambos = ra.tipo === 'medido' && rb.tipo === 'medido'
  const diferentes = ambos && (ra.idade !== rb.idade || ra.soCurtidas !== rb.soCurtidas || ra.soComentarios !== rb.soComentarios)
  const relReacao = ambos && !diferentes ? relacaoDoPar(ra.x, rb.x, nomes, { art: 'o', noun: 'engajamento' }) : null

  const semCarregar: MedidasDoPar['semCarregar'] = []
  if (la.naoCarregou) semCarregar.push({ lado: 'A', nome: a.name })
  if (lb.naoCarregou) semCarregar.push({ lado: 'B', nome: b.name })

  const nichosDiferentes = a.niche !== b.niche
  let contexto: string | null = null
  if (semCarregar.length === 0) {
    if (nichosDiferentes) contexto = `Nichos diferentes (${a.nicheLabel ?? 'sem nicho'} e ${b.nicheLabel ?? 'sem nicho'}): a régua ordena cada canal dentro do próprio nicho, não diz quem é melhor.`
  } else if (semCarregar.length === 1) {
    contexto = `Tamanho: sem comparação, a leitura dos inscritos de ${semCarregar[0]!.nome} falhou.`
  }

  return {
    hojeSP, lados: [la, lb], semCarregar,
    direcao: grupoDeDirecao(pack, hojeSP, [a, b], [la, lb]),
    primeiros: { fraseDaData: fraseDasPrimeiras24h(), linhas: linhasM1 },
    acerto: { lados: [la.acerto, lb.acerto], nota: la.naoCarregou || lb.naoCarregou ? null : 'Cada canal contra a própria mediana: mede regularidade, não tamanho.' },
    reacao: { lados: [ra, rb], diferentes, relacao: relReacao },
    nichosDiferentes, semCanalProprio: !a.own && !b.own, contexto,
  }
}
