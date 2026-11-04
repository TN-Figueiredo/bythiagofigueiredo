// Observatório — o núcleo de aquecer o cache depois da coleta (F3-cache T3). Sem next/cache: quem lê e quem grava no cache são as
// funções injetadas (as mesmas que a tela usa), então a entrada aquecida é a que a tela lê. A rota `api/cron/observatorio-aquecer`
// só valida, responde 202 e chama `aquecerCanais` no `after()` dela.
import { comMedicao, novaMedicao } from './medicao-abertura'

/** Depois da invalidação, o envio das etiquetas do cron ainda corre: a 1ª passada espera até `invalidadoEm` + isto. */
export const ESPERA_DA_ETIQUETA_MS = 1_500
/** O Next não espera a gravação de um miss (ela vai para `pendingRevalidates`): sem esta pausa os últimos canais da 1ª passada contariam como regravados. */
export const PAUSA_ENTRE_PASSADAS_MS = 2_000
/** Nenhum canal novo começa se o restante do prazo for menor que isto (T0: o pior canal levou 2,8 s). */
export const AQUECER_CANAL_PIOR_MS = 12_000
/** 120 s da função menos 30 s de folga. */
export const PRAZO_INTERNO_MS = 90_000
export const AQUECER_CONCORRENCIA = 6
/** Quantos canais do fim da 1ª passada ainda podem estar em PUT na 2ª; contados à parte. */
export const ULTIMOS_DA_PASSADA = 6

export interface CanalViva { id: string; last: number | null }

export interface DepsAquecer<C extends CanalViva> {
  /**
   * A leitura estreita: devolve só os canais da lista que são do site (`descartados` = ids de fora, contados) e lança se a leitura falha.
   * `null` = o site inteiro. A ordem devolvida é a da lista.
   */
  lerVivas(ids: readonly string[] | null): Promise<{ canais: C[]; descartados: number }>
  /** O pacote do canal pela mesma função da tela (`readChannel`). */
  lerPacote(c: C): Promise<unknown>
  /** As medidas do canal pela mesma função da tela (`lerPlanosDoCanal`); `parcial` = causa quando o Next não guardou. */
  lerMedidas(c: C): Promise<{ resposta: unknown; parcial: string | null }>
  agora(): number
  dormir(ms: number): Promise<void>
  prazoMs: number
  /** Quando o cron começou a mandar as etiquetas; ausente ou no futuro, espera no máximo `ESPERA_DA_ETIQUETA_MS`. */
  invalidadoEm?: number | null
}

export interface ResultadoAquecer {
  status: 'ok' | 'falha'
  /** O que o log e o `cron_health` dizem: a frase da falha, ou a nota de um ok sem trabalho. */
  motivo: string | null
  N: number
  aquecidos: number
  regravados: number
  regravados_ultimos6: number
  descartados: number
  fora_do_cache: number
  bytes_lidos: number
  duracao_ms: number
  /** causa → quantos canais não foram aquecidos por ela */
  nao_aquecidos: Record<string, number>
}

type Estado = 'ok' | 'parcial' | 'erro' | 'prazo'
interface Passo { estado: Estado; causa?: string; frios: number; bytes: number }

const tam = (x: unknown): number => { try { return JSON.stringify(x)?.length ?? 0 } catch { return 0 } }

/** Corrida contra o prazo, com o timer sempre limpo; o que perde não deixa erro solto. */
async function dentroDoPrazo<T>(p: Promise<T>, ms: number): Promise<{ valor: T } | 'prazo'> {
  p.catch(() => undefined)
  if (!(ms > 0)) return 'prazo'
  let t: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([p.then(valor => ({ valor })), new Promise<'prazo'>(r => { t = setTimeout(() => r('prazo'), ms) })])
  } finally {
    clearTimeout(t)
  }
}

async function umCanal<C extends CanalViva>(c: C, deps: DepsAquecer<C>, restanteMs: number): Promise<Passo> {
  const m = novaMedicao('aquecer')
  const total = (): number => Object.values(m.frios).reduce((a, b) => a + b, 0)
  let r: { valor: [PromiseSettledResult<unknown>, PromiseSettledResult<{ resposta: unknown; parcial: string | null }>] } | 'prazo'
  try {
    r = await dentroDoPrazo(comMedicao(m, () => Promise.all([
      deps.lerPacote(c).then(v => ({ status: 'fulfilled', value: v }) as PromiseSettledResult<unknown>, (e: unknown) => ({ status: 'rejected', reason: e }) as PromiseSettledResult<unknown>),
      deps.lerMedidas(c).then(v => ({ status: 'fulfilled', value: v }) as PromiseSettledResult<{ resposta: unknown; parcial: string | null }>, (e: unknown) => ({ status: 'rejected', reason: e }) as PromiseSettledResult<{ resposta: unknown; parcial: string | null }>),
    ])), restanteMs)
  } catch {
    return { estado: 'erro', causa: 'excecao', frios: total(), bytes: 0 }
  }
  if (r === 'prazo') return { estado: 'prazo', causa: 'prazo', frios: total(), bytes: 0 }
  const [pacote, medidas] = r.valor
  if (pacote.status === 'rejected' || medidas.status === 'rejected') return { estado: 'erro', causa: 'leitura_falhou', frios: total(), bytes: 0 }
  const frios = total()
  const bytes = tam(pacote.value) + tam(medidas.value.resposta)
  if (medidas.value.parcial) return { estado: 'parcial', causa: 'leitura_parcial', frios, bytes }
  return { estado: 'ok', frios, bytes }
}

/** Percorre a lista com `limite` ao mesmo tempo, na ordem; o canal que não cabe mais no prazo não começa (fica `undefined`). */
async function passada<C extends CanalViva>(lista: readonly C[], deps: DepsAquecer<C>, fim: number): Promise<Array<Passo | undefined>> {
  const out = new Array<Passo | undefined>(lista.length).fill(undefined)
  let prox = 0
  const operario = async (): Promise<void> => {
    for (;;) {
      const i = prox++
      if (i >= lista.length) return
      const restante = fim - deps.agora()
      if (restante < AQUECER_CANAL_PIOR_MS) return // nenhum canal novo: os seguintes também não cabem
      out[i] = await umCanal(lista[i]!, deps, restante)
    }
  }
  await Promise.all(Array.from({ length: Math.min(AQUECER_CONCORRENCIA, lista.length) }, operario))
  return out
}

export async function aquecerCanais<C extends CanalViva>(ids: readonly string[] | null, deps: DepsAquecer<C>): Promise<ResultadoAquecer> {
  const t0 = deps.agora()
  const fim = t0 + deps.prazoMs
  const base = { N: 0, aquecidos: 0, regravados: 0, regravados_ultimos6: 0, descartados: 0, fora_do_cache: 0, bytes_lidos: 0, nao_aquecidos: {} as Record<string, number> }
  const encerrar = (status: 'ok' | 'falha', motivo: string | null, extra: Partial<typeof base> = {}): ResultadoAquecer =>
    ({ status, motivo, ...base, ...extra, duracao_ms: Math.max(0, deps.agora() - t0) })

  // 1. a espera da etiqueta: o envio das etiquetas do cron termina logo depois de `invalidadoEm`
  const ie = deps.invalidadoEm
  const espera = typeof ie === 'number' && Number.isFinite(ie) && ie <= t0 ? Math.min(ESPERA_DA_ETIQUETA_MS, Math.max(0, ie + ESPERA_DA_ETIQUETA_MS - t0)) : ESPERA_DA_ETIQUETA_MS
  if (espera > 0) await deps.dormir(espera)

  // 2. a leitura estreita (também a conferência de que cada id é do site): falha nunca vira N = 0
  let vivas: { canais: C[]; descartados: number }
  try {
    vivas = await deps.lerVivas(ids)
  } catch {
    return encerrar('falha', 'a leitura dos canais falhou')
  }
  const descartados = vivas.descartados
  if (ids && ids.length > 0 && vivas.canais.length === 0 && descartados > 0) return encerrar('falha', 'todos os ids descartados (' + descartados + ')', { descartados })

  // N: fora o canal sem sincronização boa (a tela não usa cache para ele)
  const elegiveis = vivas.canais.filter(c => c.last != null)
  const foraDoCache = vivas.canais.length - elegiveis.length
  if (elegiveis.length === 0) {
    const nota = vivas.canais.length === 0 ? 'o site não tem canais' : 'todos os canais ainda sem sincronização boa (fora do cache)'
    return encerrar('ok', nota, { descartados, fora_do_cache: foraDoCache })
  }

  // 3. 1ª passada
  const p1 = await passada(elegiveis, deps, fim)
  const naoAq: Record<string, number> = {}
  const nao = (causa: string): void => { naoAq[causa] = (naoAq[causa] ?? 0) + 1 }
  let bytes = 0
  for (const p of p1) if (p) bytes += p.bytes

  // 4. a pausa e a 2ª passada, na mesma ordem, só nos canais que a 1ª leu por inteiro
  const confirmaveis = elegiveis.map((c, i) => ({ c, i })).filter(x => p1[x.i]?.estado === 'ok')
  const iniciados = p1.map((p, i) => (p ? i : -1)).filter(i => i >= 0)
  const ultimos6 = new Set(iniciados.slice(-ULTIMOS_DA_PASSADA))
  if (confirmaveis.length > 0) await deps.dormir(PAUSA_ENTRE_PASSADAS_MS)
  const p2 = await passada(confirmaveis.map(x => x.c), deps, fim)

  let aquecidos = 0, regravados = 0, regravadosUltimos6 = 0
  elegiveis.forEach((_c, i) => {
    const a = p1[i]
    if (!a) { nao('sem_tempo'); return }
    if (a.estado !== 'ok') { nao(a.causa ?? a.estado); return }
    const j = confirmaveis.findIndex(x => x.i === i)
    const b = p2[j]
    if (!b) { nao('sem_tempo'); return }
    bytes += b.frios > 0 ? b.bytes : 0
    if (b.estado !== 'ok') { nao(b.causa ?? b.estado); return }
    aquecidos++
    if (b.frios > 0) { if (ultimos6.has(i)) regravadosUltimos6++; else regravados++ }
  })

  const N = elegiveis.length
  const extra = { N, aquecidos, regravados, regravados_ultimos6: regravadosUltimos6, descartados, fora_do_cache: foraDoCache, bytes_lidos: bytes, nao_aquecidos: naoAq }
  if (aquecidos < N) {
    const causas = Object.entries(naoAq).map(([k, v]) => k + ' ' + v).join(', ')
    return encerrar('falha', 'aqueceu ' + aquecidos + ' de ' + N + ' (' + causas + ')', extra)
  }
  return encerrar('ok', null, extra)
}
