// O que valeu para o dia quando havia teste A/B: segundos de cada variante dentro do dia, calculados
// duas vezes (dia do Pacífico com horário de verão e dia em UTC-8 fixo), e as regras de nulo.
// Função pura. `started_at` é a hora em que o servidor gravou o ciclo, não uma confirmação do YouTube.
import { boundsAnalytics, boundsReporting, type Intervalo } from './day-pt'

export interface AbTest {
  id: string
  status: string
  paused_at: string | null
  completed_at: string | null
  original_title: string | null
}

export interface AbCycle {
  id: string
  test_id: string
  variant_id: string
  started_at: string
  ended_at: string | null
  applied_metadata: { title_set?: string | null } | null
}

export type MotivoNulo = 'teste_ausente' | 'data_invalida' | 'mais_de_um_teste' | 'ciclo_aberto_duplicado' | 'soma_acima_do_dia' | 'fora_de_ciclo'

export interface AbDia {
  ab_test_id: string | null
  ab_variant_id: string | null
  seconds_on_air_analytics: number | null
  seconds_other_analytics: number | null
  seconds_on_air_reporting: number | null
  seconds_other_reporting: number | null
  /** O título que valeu para o dia; null quando não dá para afirmar. */
  title: string | null
  /** true = `thumbnail_sha256` do dia pode copiar o sha256 da captura. */
  thumbCopiaCaptura: boolean
  motivoNulo: MotivoNulo | null
}

/** Fechar um ciclo e abrir o seguinte são duas gravações: até 5 s de sobreposição não é "soma acima do dia". */
export const TOLERANCIA_SOMA_MS = 5_000

const ms = (s: string): number => new Date(s).getTime()
const texto = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null)
const segundos = (v: number): number => Math.round(v / 1000)
const soma = (m: Map<string, number>): number => [...m.values()].reduce((s, v) => s + v, 0)

/** Ciclo aberto só vai até o fim do dia se o teste está ativo; senão termina onde o teste parou. */
function fimEfetivo(c: AbCycle, t: AbTest | undefined): number {
  if (c.ended_at) return ms(c.ended_at)
  if (t?.status === 'active') return Number.POSITIVE_INFINITY
  const inicio = ms(c.started_at)
  const pausa = t?.paused_at ? ms(t.paused_at) : null
  const conclusao = t?.completed_at ? ms(t.completed_at) : null
  const parou = t?.status === 'completed' || t?.status === 'archived' ? (conclusao ?? pausa) : (pausa ?? conclusao)
  return Math.max(inicio, parou ?? inicio)
}

function sobreposicao(inicio: number, fim: number, i: Intervalo): number {
  return Math.max(0, Math.min(fim, i.end) - Math.max(inicio, i.start))
}

/** A chave de maior valor; empate resolve pela menor chave, para o resultado ser estável. */
function maior(m: Map<string, number>): [string, number] {
  let melhor: [string, number] | null = null
  for (const e of m) {
    if (!melhor || e[1] > melhor[1] || (e[1] === melhor[1] && e[0] < melhor[0])) melhor = e
  }
  return melhor!
}

export function calcularAbDoDia(i: {
  day: string
  tests: AbTest[]
  cycles: AbCycle[]
  /** epoch ms do instante da captura */
  capturedAt: number
  titleAtCapture: string | null
}): AbDia {
  const A = boundsAnalytics(i.day)
  const R = boundsReporting(i.day)
  const testes = new Map(i.tests.map(t => [t.id, t]))

  // Dado que não dá para ler (data ilegível, teste fora de `tests`) vem ANTES de todas as outras regras:
  // sem ele os segundos são zero e o dia viraria "sem A/B" (título e thumbnail da captura) em silêncio.
  // Data inválida precede teste ausente, e dentro de cada uma vale o primeiro ciclo na ordem de entrada.
  const fimDoDiaMs = Math.max(A.end, R.end)
  const nulo = (testId: string, motivoNulo: MotivoNulo): AbDia => ({
    ab_test_id: testId, ab_variant_id: null,
    seconds_on_air_analytics: null, seconds_other_analytics: null,
    seconds_on_air_reporting: null, seconds_other_reporting: null,
    title: null, thumbCopiaCaptura: false, motivoNulo,
  })
  const invalido = i.cycles.find(c => Number.isNaN(ms(c.started_at)) || (c.ended_at !== null && Number.isNaN(ms(c.ended_at))))
  if (invalido) return nulo(invalido.test_id, 'data_invalida')
  const semTeste = i.cycles.find((c) => {
    if (testes.has(c.test_id)) return false
    const inicio = ms(c.started_at)
    if (c.ended_at === null) return inicio < fimDoDiaMs
    return sobreposicao(inicio, ms(c.ended_at), A) > 0 || sobreposicao(inicio, ms(c.ended_at), R) > 0
  })
  if (semTeste) return nulo(semTeste.test_id, 'teste_ausente')

  const linhas = i.cycles.map((c) => {
    const inicio = ms(c.started_at)
    const fim = fimEfetivo(c, testes.get(c.test_id))
    return { c, inicio, fim, a: sobreposicao(inicio, fim, A), r: sobreposicao(inicio, fim, R) }
  })
  const doDia = linhas.filter(l => l.a > 0 || l.r > 0)

  if (doDia.length === 0) {
    return {
      ab_test_id: null, ab_variant_id: null,
      seconds_on_air_analytics: null, seconds_other_analytics: null,
      seconds_on_air_reporting: null, seconds_other_reporting: null,
      title: i.titleAtCapture, thumbCopiaCaptura: true, motivoNulo: null,
    }
  }

  const porTeste = new Map<string, number>()
  for (const l of doDia) porTeste.set(l.c.test_id, (porTeste.get(l.c.test_id) ?? 0) + l.a)
  const [testId] = maior(porTeste)
  const doTeste = doDia.filter(l => l.c.test_id === testId)

  const varA = new Map<string, number>()
  const varR = new Map<string, number>()
  for (const l of doTeste) {
    varA.set(l.c.variant_id, (varA.get(l.c.variant_id) ?? 0) + l.a)
    varR.set(l.c.variant_id, (varR.get(l.c.variant_id) ?? 0) + l.r)
  }
  const [variantId, onAirA] = maior(varA)
  const somaA = soma(varA)
  const somaR = soma(varR)
  const onAirR = varR.get(variantId) ?? 0
  const duracaoA = A.end - A.start
  const duracaoR = R.end - R.start

  // Todos os ciclos do teste, inclusive os que começaram depois do dia (retomada, rotação pós-dia).
  const todosDoTeste = linhas.filter(l => l.c.test_id === testId)
  const fimDoDia = Math.max(A.end, R.end)
  const abertos = todosDoTeste.filter(l => l.c.ended_at === null && l.inicio < fimDoDia)
  const duplicado =
    abertos.length > 1 || abertos.some(a => todosDoTeste.some(o => o.c.id !== a.c.id && o.inicio > a.inicio))

  let motivoNulo: MotivoNulo | null = null
  if (porTeste.size > 1) motivoNulo = 'mais_de_um_teste'
  else if (duplicado) motivoNulo = 'ciclo_aberto_duplicado'
  else if (somaA > duracaoA + TOLERANCIA_SOMA_MS || somaR > duracaoR + TOLERANCIA_SOMA_MS) motivoNulo = 'soma_acima_do_dia'
  else if (duracaoA - somaA > onAirA) motivoNulo = 'fora_de_ciclo'

  const cicloDaVariante = doTeste
    .filter(l => l.c.variant_id === variantId)
    .sort((x, y) => y.a - x.a || y.inicio - x.inicio)[0]!
  const noArNaCaptura = [...todosDoTeste]
    .sort((x, y) => y.inicio - x.inicio)
    .find(l => l.inicio <= i.capturedAt && i.capturedAt < l.fim)

  return {
    ab_test_id: testId,
    ab_variant_id: motivoNulo ? null : variantId,
    seconds_on_air_analytics: segundos(onAirA),
    seconds_other_analytics: segundos(somaA - onAirA),
    seconds_on_air_reporting: segundos(onAirR),
    seconds_other_reporting: segundos(somaR - onAirR),
    title: motivoNulo
      ? null
      : (texto(cicloDaVariante.c.applied_metadata?.title_set) ?? texto(testes.get(testId)?.original_title) ?? i.titleAtCapture),
    thumbCopiaCaptura: !motivoNulo && noArNaCaptura?.c.variant_id === variantId,
    motivoNulo,
  }
}
