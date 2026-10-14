// A5 · E8 · Tarefa 12b: leitor de servidor da curva de retenção do vídeo próprio. Só leitura, sem tela (a tela é a Tarefa 13).
// O molde é o de `ler.ts` e `ler-dimensoes.ts`:
//   - o acesso é a PROVA de leitura privada do site (`LeituraPrivadaDoSite`): sem prova (ou objeto forjado), canal que não é uuid ou ytId fora do
//     formato = 'negado' SEM consultar nada. A guarda é a mesma de `ler.ts` (escrita aqui, sem editar aquele arquivo);
//   - toda consulta filtra por site (o da prova), canal e vídeo;
//   - erro de banco é LANÇADO (`ObservatoryLoadError`); resposta que não é lista também. Nunca lista vazia disfarçada;
//   - a única ausência que não lança é a TABELA da curva (migration MG5 ainda não aplicada neste banco): vira o vazio com a marca
//     `tabelaAusente` e um aviso ao Sentry (sem conteúdo). A tela diz "ainda não coletamos", que é verdade;
//   - ponto de curva em forma ruim derruba a curva inteira (tratada como ausente, `descartados++`): a tela nunca desenha o que o
//     banco não garante, e nenhuma ausência vira zero.
import 'server-only'
import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Janela } from '@/lib/youtube/coleta/retencao-regra'
import { ObservatoryLoadError } from '../niches-db'
import { leituraValida } from './leitura-privada'
import type { Pedido } from './ler'
import type { PontoCurva } from './retencao-curva'
import type { DiaYt, Privado } from './tipos'

/** A mesma de `ler.ts:25` (que não a exporta e não é editado por esta tarefa). */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const YT_ID = /^[A-Za-z0-9_-]{11}$/
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/

/** Quantas leituras entram na lista; a 201.ª só serve para saber que passou. */
export const TETO_LEITURAS = 200
/** Quantas tentativas se leem para achar a última e a última com resposta. */
export const TETO_TENTATIVAS = 30
/** Quantas leituras da vida (com pontos) entram no histórico, além da mais antiga; a 27.ª só serve para saber se há algo entre as duas pontas. */
export const TETO_HISTORICO = 26

/** O `kind` da tentativa de cada janela (E5b T4: uma consulta por tipo). */
const KIND_DA_JANELA: Record<Janela, string> = { vida: 'retencao_vida', primeiros_7_dias: 'retencao_7d', primeiros_30_dias: 'retencao_30d' }

/** Todas as janelas, por chave de registro: uma `Janela` nova no tipo quebra a compilação aqui até ser tratada. */
const JANELAS_REG: Record<Janela, true> = { vida: true, primeiros_7_dias: true, primeiros_30_dias: true }
const JANELAS = Object.keys(JANELAS_REG) as Janela[]
const ehJanela = (x: unknown): x is Janela => typeof x === 'string' && Object.prototype.hasOwnProperty.call(JANELAS_REG, x)

const RESPONDEU = ['ok', 'sem_dado_na_janela'] as const
type Resposta = (typeof RESPONDEU)[number]

/** 42P01 tabela (Postgres) e PGRST205 tabela fora do schema cache (PostgREST). Coluna ausente (42703) NÃO entra: é outro defeito. */
const TABELA_AUSENTE = new Set(['42P01', 'PGRST205'])

export interface CurvaLida {
  janela: Janela
  windowStart: DiaYt
  windowEnd: DiaYt
  coletadaEm: string
  pontos: PontoCurva[]
  metricas: string[]
  /** views do diário na leitura; nulo = não se sabia (nunca 0) */
  viewsAtRead: number | null
}

export interface TentativasDaJanela {
  ultima: { dia: string; resultado: string } | null
  ultimaResposta: { dia: string; resultado: Resposta } | null
}

export interface RetencaoDoVideo {
  ytId: string
  /** a mais recente de cada janela; janela sem curva (ou com curva descartada) não aparece */
  curvas: Partial<Record<Janela, CurvaLida>>
  /** todas, da mais nova para a mais velha (até TETO_LEITURAS) */
  leituras: Array<{ janela: Janela; windowEnd: DiaYt; coletadaEm: string }>
  /** passou de TETO_LEITURAS */
  leiturasCortadas: boolean
  /** a última tentativa do kind `retencao_vida`, qualquer resultado */
  ultimaTentativa: { dia: string; resultado: string } | null
  /** a última tentativa em que a API respondeu (`ok` ou `sem_dado_na_janela`) */
  ultimaResposta: { dia: string; resultado: Resposta } | null
  /** leituras de `vida` COM pontos: as TETO_HISTORICO mais recentes e, se não estiver entre elas, a mais antiga; da mais nova para a mais velha */
  historicoVida: CurvaLida[]
  /** há leituras de `vida` entre a mais antiga e as mais recentes que ficaram fora do histórico */
  historicoCortado: boolean
  /** por janela: a última tentativa (qualquer resultado) e a última em que a API respondeu */
  tentativas: Record<Janela, TentativasDaJanela>
  /**
   * Curvas, itens da lista e tentativas ignorados por forma ruim (ponto não numérico, fora de 0 a 1, fora de ordem, dia ilegível…).
   * Quem chama avisa o Sentry uma vez por requisição. Uma linha ruim que é ao mesmo tempo item da lista e a curva da janela conta duas vezes.
   */
  descartados: number
  /** a tabela da curva não existe neste banco (migration não aplicada): vazio por falta de tabela, não por falta de coleta */
  tabelaAusente: boolean
  /**
   * Janelas cuja leitura mais recente existe mas é ilegível (curva descartada). Ausente de `curvas` por dado ruim, NÃO por falta de coleta:
   * a tela mostra erro de leitura, nunca "ainda não coletamos". Sempre uma lista (vazia quando nenhuma).
   */
  janelasIlegiveis: Janela[]
}

interface Erro { code?: string; message: string }
interface Consulta { range(de: number, ate: number): PromiseLike<{ data: unknown; error: Erro | null }> }
type Lida<T> = { ausente: true } | { ausente: false; linhas: T[] }

/** Uma faixa de uma consulta já filtrada e ordenada. Erro de banco lança; tabela ausente (só se `aceitaAusente`) devolve `ausente`; resposta sem lista lança. */
async function ler<T>(tabela: string, q: Consulta, de: number, ate: number, aceitaAusente: boolean): Promise<Lida<T>> {
  const { data, error } = await q.range(de, ate)
  if (error) {
    if (aceitaAusente && error.code && TABELA_AUSENTE.has(error.code)) return { ausente: true }
    throw new ObservatoryLoadError(tabela, error.code, error.message)
  }
  // Resposta sem lista NÃO é lista vazia.
  if (!Array.isArray(data)) throw new ObservatoryLoadError(tabela, undefined, 'resposta sem lista')
  return { ausente: false, linhas: data as T[] }
}

const tentativasVazias = (): Record<Janela, TentativasDaJanela> => ({
  vida: { ultima: null, ultimaResposta: null },
  primeiros_7_dias: { ultima: null, ultimaResposta: null },
  primeiros_30_dias: { ultima: null, ultimaResposta: null },
})

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const numeroFinito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** 'AAAA-MM-DD' que existe no calendário (2026-02-30 não). */
function diaValido(x: unknown): x is DiaYt {
  if (typeof x !== 'string' || !FORMATO_DIA.test(x)) return false
  const t = Date.parse(x + 'T00:00:00Z')
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === x
}
/** Instante ISO ('AAAA-MM-DD' seguido de T ou espaço): `Date.parse('12')` existe no V8 e não é instante. */
const instanteValido = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}[T ]/.test(x) && Number.isFinite(Date.parse(x))

/** bigint/numeric chegam como número ou texto; nulo, vazio, não finito e negativo viram nulo (não se sabia), nunca 0. */
function views(x: unknown): number | null {
  const n = typeof x === 'number' ? x : typeof x === 'string' && x.trim() !== '' ? Number(x) : Number.NaN
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Os pontos da curva: número finito, `0 <= t <= 1`, `ratio >= 0` (pode passar de 1), `relative` número finito ou nulo, `t` estritamente crescente. Qualquer falha = null. */
function pontosValidos(x: unknown): PontoCurva[] | null {
  if (!Array.isArray(x) || x.length === 0) return null
  const out: PontoCurva[] = []
  let anterior = -Infinity
  for (const p of x as unknown[]) {
    if (!ehObjeto(p)) return null
    const { t, ratio, relative } = p
    if (!numeroFinito(t) || t < 0 || t > 1) return null
    if (!numeroFinito(ratio) || ratio < 0) return null
    if (relative != null && !numeroFinito(relative)) return null
    if (t <= anterior) return null
    anterior = t
    out.push({ t, ratio, relative: relative == null ? null : relative })
  }
  return out
}

function curvaValida(janela: Janela, r: Record<string, unknown>): CurvaLida | null {
  if (r.window_kind !== janela) return null
  if (!diaValido(r.window_start) || !diaValido(r.window_end) || !instanteValido(r.collected_at)) return null
  const pontos = pontosValidos(r.points)
  if (pontos == null) return null
  if (!Array.isArray(r.metrics_returned) || !(r.metrics_returned as unknown[]).every(m => typeof m === 'string')) return null
  return {
    janela, windowStart: r.window_start, windowEnd: r.window_end, coletadaEm: r.collected_at,
    pontos, metricas: [...(r.metrics_returned as string[])], viewsAtRead: views(r.views_at_read),
  }
}

/** O site da prova de edição, ou null: sem prova, ou canal que não é uuid (o Postgres lançaria 22P02) = 'negado', sem consulta. A mesma regra de `ler.ts`. */
const siteAutorizado = (p: Pedido): string | null => (leituraValida(p.leitura) && UUID.test(p.canalId) ? p.leitura.siteId : null)

interface LinhaLista { window_kind: unknown; window_end: unknown; collected_at: unknown }
interface LinhaTentativa { attempt_day: unknown; outcome: unknown }

/**
 * A retenção de um vídeo do canal próprio: a curva mais recente de cada janela, a lista das leituras e o que a coleta tentou por último.
 * Sem prova de acesso: `negado`. Erro de banco: lança. Tabela da curva ausente: o vazio com `tabelaAusente`.
 */
export async function lerRetencao(sb: SupabaseClient, p: Pedido & { ytId: string }): Promise<Privado<RetencaoDoVideo>> {
  const siteId = siteAutorizado(p)
  if (siteId == null) return { acesso: 'negado' }
  if (typeof p.ytId !== 'string' || !YT_ID.test(p.ytId)) return { acesso: 'negado' }
  const ytId = p.ytId
  const vazio = (tabelaAusente: boolean): RetencaoDoVideo => ({
    ytId, curvas: {}, leituras: [], leiturasCortadas: false, ultimaTentativa: null, ultimaResposta: null, descartados: 0, tabelaAusente, janelasIlegiveis: [],
    historicoVida: [], historicoCortado: false, tentativas: tentativasVazias(),
  })

  const doVideo = (colunas: string) => sb.from('yt_own_video_retention').select(colunas)
    .eq('site_id', siteId).eq('channel_id', p.canalId).eq('youtube_video_id', ytId).eq('segment', 'organico')
  const colunasCurva = 'window_kind, window_start, window_end, collected_at, points, metrics_returned, views_at_read'

  // a lista (SEM points) e a mais recente de cada janela (com points, uma linha cada): quatro consultas pequenas, em paralelo
  const ordemRecente = <Q extends { order(c: string, o?: { ascending?: boolean }): Q }>(q: Q) => q.order('window_end', { ascending: false }).order('collected_at', { ascending: false })
  const [lista, recentesVida, maisAntigaVida, ...porJanela] = await Promise.all([
    ler<LinhaLista>('yt_own_video_retention',
      doVideo('window_kind, window_end, collected_at')
        .order('window_end', { ascending: false }).order('collected_at', { ascending: false }).order('window_kind'),
      0, TETO_LEITURAS, true),
    // o histórico da vida (com pontos): as TETO_HISTORICO + 1 mais recentes (a última é só sentinela) e a mais antiga
    ler<unknown>('yt_own_video_retention', ordemRecente(doVideo(colunasCurva).eq('window_kind', 'vida')), 0, TETO_HISTORICO, true),
    ler<unknown>('yt_own_video_retention',
      doVideo(colunasCurva).eq('window_kind', 'vida').order('window_end', { ascending: true }).order('collected_at', { ascending: true }), 0, 0, true),
    ...JANELAS.map(j => ler<unknown>('yt_own_video_retention',
      doVideo(colunasCurva).eq('window_kind', j)
        .order('window_end', { ascending: false }).order('collected_at', { ascending: false }),
      0, 0, true)),
  ])
  if (lista.ausente || recentesVida.ausente || maisAntigaVida.ausente || porJanela.some(j => j.ausente)) {
    // sem conteúdo do banco, sem id de vídeo, sem canal: só o fato
    Sentry.captureMessage('observatorio-proprio: tabela yt_own_video_retention ausente (migration MG5 não aplicada)', {
      level: 'warning', tags: { component: 'observatorio-proprio', step: 'ler-retencao' },
    })
    return { acesso: 'ok', dado: vazio(true) }
  }

  let descartados = 0
  const curvas: Partial<Record<Janela, CurvaLida>> = {}
  const janelasIlegiveis: Janela[] = []
  JANELAS.forEach((j, i) => {
    const linha = porJanela[i]!
    if (linha.ausente) return
    const primeira: unknown = linha.linhas[0]
    if (primeira === undefined) return
    const c = ehObjeto(primeira) ? curvaValida(j, primeira) : null
    if (c == null) { descartados++; janelasIlegiveis.push(j); return }
    curvas[j] = c
  })

  // o histórico da vida: ilegível sai e conta; a mais recente ilegível já foi contada acima (janelasIlegiveis)
  const doHistorico = (linhas: unknown[], pulaPrimeira: boolean): CurvaLida[] => {
    const out: CurvaLida[] = []
    linhas.forEach((l, i) => {
      const c = ehObjeto(l) ? curvaValida('vida', l) : null
      if (c == null) { if (!(pulaPrimeira && i === 0)) descartados++; return }
      out.push(c)
    })
    return out
  }
  const mesma = (a: CurvaLida, b: CurvaLida) => a.windowEnd === b.windowEnd && a.coletadaEm === b.coletadaEm
  const recentesBrutas = recentesVida.ausente ? [] : recentesVida.linhas
  const noTeto = recentesBrutas.slice(0, TETO_HISTORICO)
  const historicoVida = doHistorico(noTeto, true)
  // a mais antiga que já veio entre as recentes (mesma leitura) não é lida nem contada de novo
  const chave = (l: unknown) => (ehObjeto(l) ? `${String(l.window_end)}|${String(l.collected_at)}` : null)
  const jaVistas = new Set(noTeto.map(chave))
  const antigaBruta = maisAntigaVida.ausente ? [] : maisAntigaVida.linhas.slice(0, 1).filter(l => !jaVistas.has(chave(l)))
  const maisAntiga = doHistorico(antigaBruta, false)[0]
  const sentinela = recentesBrutas.length > TETO_HISTORICO ? recentesBrutas[TETO_HISTORICO] : undefined
  const sentinelaCurva = sentinela !== undefined && ehObjeto(sentinela) ? curvaValida('vida', sentinela) : null
  let historicoCortado = false
  if (maisAntiga !== undefined && !historicoVida.some(c => mesma(c, maisAntiga))) {
    // a mais antiga fica fora das 26 mais recentes: há corte só se ela não é a 27.ª linha (a sentinela)
    const ehASentinela = sentinelaCurva != null && mesma(sentinelaCurva, maisAntiga)
    historicoVida.push(maisAntiga)
    historicoCortado = !ehASentinela
  }

  const leituras: RetencaoDoVideo['leituras'] = []
  for (const r of lista.linhas) {
    if (!ehObjeto(r) || !ehJanela(r.window_kind) || !diaValido(r.window_end) || !instanteValido(r.collected_at)) { descartados++; continue }
    leituras.push({ janela: r.window_kind, windowEnd: r.window_end, coletadaEm: r.collected_at })
  }
  const leiturasCortadas = lista.linhas.length > TETO_LEITURAS
  if (leiturasCortadas) leituras.length = Math.min(leituras.length, TETO_LEITURAS)

  // as tentativas DESTE vídeo, uma consulta por tipo (`retencao_vida`, `retencao_7d`, `retencao_30d`), da mais nova para a mais velha
  const resposta = (x: unknown): x is Resposta => (RESPONDEU as readonly unknown[]).includes(x)
  const tentativasDa = async (kind: string): Promise<{ t: TentativasDaJanela; descartadas: number }> => {
    const tentativas = () => sb.from('yt_own_collection_attempts').select('attempt_day, outcome')
      .eq('site_id', siteId).eq('channel_id', p.canalId).eq('scope_type', 'video').eq('scope_id', ytId).eq('kind', kind)
    const recentes = await ler<LinhaTentativa>('yt_own_collection_attempts',
      tentativas().order('attempt_day', { ascending: false }).order('last_attempt_at', { ascending: false }), 0, TETO_TENTATIVAS - 1, false)
    if (recentes.ausente) throw new ObservatoryLoadError('yt_own_collection_attempts', undefined, 'tabela ausente') // inalcançável: aceitaAusente é false
    const lidas = recentes.linhas
    let descartadas = 0
    const t: TentativasDaJanela = { ultima: null, ultimaResposta: null }
    for (const [i, x] of lidas.entries()) {
      if (!ehObjeto(x) || !diaValido(x.attempt_day)) {
        // A mais nova ilegível não deixa a seguinte virar "última" em silêncio (a curva ruim também não cai para a anterior).
        if (i === 0) throw new ObservatoryLoadError('yt_own_collection_attempts', undefined, 'dia da tentativa mais recente ilegível')
        descartadas++; continue
      }
      const resultado = typeof x.outcome === 'string' ? x.outcome : 'desconhecido'
      if (t.ultima == null) t.ultima = { dia: x.attempt_day, resultado }
      if (resposta(x.outcome)) { t.ultimaResposta = { dia: x.attempt_day, resultado: x.outcome }; break }
    }
    // As 30 mais novas podem ser todas falha: a última resposta mais antiga existe e "nenhuma" seria mentira. Busca à parte, uma linha.
    if (t.ultimaResposta == null && lidas.length >= TETO_TENTATIVAS) {
      const resp = await ler<LinhaTentativa>('yt_own_collection_attempts',
        tentativas().in('outcome', [...RESPONDEU]).order('attempt_day', { ascending: false }).order('last_attempt_at', { ascending: false }), 0, 0, false)
      const x = resp.ausente ? undefined : resp.linhas[0]
      if (x !== undefined) {
        if (ehObjeto(x) && diaValido(x.attempt_day) && resposta(x.outcome)) t.ultimaResposta = { dia: x.attempt_day, resultado: x.outcome }
        else descartadas++
      }
    }
    return { t, descartadas }
  }
  const [tVida, t7, t30] = await Promise.all(JANELAS.map(j => tentativasDa(KIND_DA_JANELA[j])))
  descartados += tVida!.descartadas + t7!.descartadas + t30!.descartadas
  const tentativas: Record<Janela, TentativasDaJanela> = { vida: tVida!.t, primeiros_7_dias: t7!.t, primeiros_30_dias: t30!.t }
  const ultimaTentativa = tentativas.vida.ultima
  const ultimaResposta = tentativas.vida.ultimaResposta

  return { acesso: 'ok', dado: { ytId, curvas, leituras, leiturasCortadas, ultimaTentativa, ultimaResposta, descartados, tabelaAusente: false, janelasIlegiveis, historicoVida, historicoCortado, tentativas } }
}
