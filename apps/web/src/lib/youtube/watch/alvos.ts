/**
 * Candidatos e conciliação da leitura da watch (A5 S4, Tarefa 9): quem deve ser lido, a que ritmo e até quando.
 * `montarCandidatos` é puro. O resto fala com o banco e nunca deixa o texto do erro sair: falha vira `{ porque, causa }`.
 * Dado ausente primeiro: leitura que falha ou vem fora da forma nunca vira "lista vazia" (o RPC não roda).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRec } from '@/lib/youtube/competitor-capture'
import { resumoTecnico } from '@/lib/youtube/agenda/motivos'
import { BANCO_MS } from '@/lib/youtube/agenda/relogio'
import type { CausaDaFalha, Lido } from '@/lib/youtube/agenda/tipos'
import { ErroDeLeitura, lerCandidatos, relatarSeguro, type RelatarHoraria } from '@/lib/youtube/horaria/gravar'
import type { CandConcorrente, CandProprio } from '@/lib/youtube/horaria/lista'
import { faixaMenosCheia, hash32 } from './rodada'

export const INCLUIR_SHORTS = true
/** D2 = sim (dono, 18/10): os próprios com mais de 14 dias entram a 1 rodada por dia. */
export const PROPRIOS_ANTIGOS: boolean = true

const DIA_MS = 86_400_000
const JANELA_CONCORRENTE_DIAS = 30
const JANELA_PROPRIA_DIAS = 14
const JANELA_DRAFT_DIAS = 30
const PAGINA = 1000
const PAGINAS = 5

export interface Candidato {
  siteId: string
  ytId: string
  tipo: 'concorrente' | 'proprio'
  motivoAte: 'janela_concorrente' | 'janela_propria' | 'proprio_antigo' | 'teste_nosso'
  coletaAte: string
  rodadasPorDia: 1 | 4
}
export interface TesteVivo { siteId: string; ytId: string }
export interface AlvoAtivo {
  id: number; siteId: string; ytId: string; horaBaseMin: number; rodadasPorDia: 1 | 4; proximaRodadaEm: string
  coletaAte: string; motivoAte: string; extensoesCurtas: number; indisponivelSeguidas: number; rodadas: number; temTesteNosso: boolean
}

export const chaveAlvo = (siteId: string, ytId: string): string => `${siteId}|${ytId}`

const instante = (s: string | null): number | null => {
  if (s === null || s === '') return null
  const ms = Date.parse(s)
  return Number.isFinite(ms) ? ms : null
}

// O CHECK de yt_watch_alvos exige 11 caracteres; um id torto no p_candidatos abortaria a conciliação inteira (23514).
const ID_YT = /^[A-Za-z0-9_-]{11}$/

/** Mesma montagem de `montarCandidatos`, mais a contagem dos ids que o filtro de 11 caracteres jogou fora (nunca em silêncio). */
export function montarCandidatosContando(
  conc: readonly CandConcorrente[],
  prop: readonly CandProprio[],
  testes: readonly TesteVivo[],
  antigos: readonly CandProprio[] | null,
  agoraMs: number,
  incluirShorts: boolean = INCLUIR_SHORTS,
): { candidatos: Candidato[]; descartados: number } {
  const todos: Candidato[] = []
  for (const c of conc) {
    if (!incluirShorts && c.isShort === true) continue
    const ms = instante(c.publishedAt)
    if (ms === null || ms > agoraMs) continue
    if (agoraMs - ms > JANELA_CONCORRENTE_DIAS * DIA_MS) continue
    if (c.canalPausado || c.canalAusente || c.missingSince !== null) continue
    todos.push({ siteId: c.siteId, ytId: c.ytId, tipo: 'concorrente', motivoAte: 'janela_concorrente',
      coletaAte: new Date(ms + JANELA_CONCORRENTE_DIAS * DIA_MS).toISOString(), rodadasPorDia: 4 })
  }
  for (const p of prop) {
    const ms = instante(p.publishedAt)
    if (ms === null || ms > agoraMs) continue
    if (agoraMs - ms > JANELA_PROPRIA_DIAS * DIA_MS) continue
    todos.push({ siteId: p.siteId, ytId: p.ytId, tipo: 'proprio', motivoAte: 'janela_propria',
      coletaAte: new Date(ms + JANELA_PROPRIA_DIAS * DIA_MS).toISOString(), rodadasPorDia: 4 })
  }
  const amanha = new Date(agoraMs + DIA_MS).toISOString()
  for (const t of testes) {
    todos.push({ siteId: t.siteId, ytId: t.ytId, tipo: 'proprio', motivoAte: 'teste_nosso', coletaAte: amanha, rodadasPorDia: 4 })
  }
  for (const a of antigos ?? []) {
    const ms = instante(a.publishedAt)
    // dentro dos 14 dias o vídeo já entra como janela_propria; sem data não há como dizer que é antigo
    if (ms === null || agoraMs - ms <= JANELA_PROPRIA_DIAS * DIA_MS) continue
    todos.push({ siteId: a.siteId, ytId: a.ytId, tipo: 'proprio', motivoAte: 'proprio_antigo', coletaAte: amanha, rodadasPorDia: 1 })
  }

  const porChave = new Map<string, Candidato>()
  const maxColeta = new Map<string, number>()
  const maxRitmo = new Map<string, 1 | 4>()
  let descartados = 0
  for (const c of todos) {
    if (!ID_YT.test(c.ytId)) { descartados++; continue }
    const k = chaveAlvo(c.siteId, c.ytId)
    const ms = Date.parse(c.coletaAte)
    maxColeta.set(k, Math.max(maxColeta.get(k) ?? 0, ms))
    maxRitmo.set(k, Math.max(maxRitmo.get(k) ?? 1, c.rodadasPorDia) === 4 ? 4 : 1)
    const atual = porChave.get(k)
    if (!atual) { porChave.set(k, c); continue }
    const vence = c.motivoAte === 'teste_nosso' && atual.motivoAte !== 'teste_nosso'
      ? true
      : atual.motivoAte === 'teste_nosso' ? false : ms > Date.parse(atual.coletaAte)
    if (vence) porChave.set(k, c)
  }
  const candidatos = [...porChave.entries()].map(([k, c]) => ({
    ...c, coletaAte: new Date(maxColeta.get(k) ?? Date.parse(c.coletaAte)).toISOString(), rodadasPorDia: maxRitmo.get(k) ?? c.rodadasPorDia,
  }))
  return { candidatos, descartados }
}

export function montarCandidatos(
  conc: readonly CandConcorrente[],
  prop: readonly CandProprio[],
  testes: readonly TesteVivo[],
  antigos: readonly CandProprio[] | null,
  agoraMs: number,
  incluirShorts: boolean = INCLUIR_SHORTS,
): Candidato[] {
  return montarCandidatosContando(conc, prop, testes, antigos, agoraMs, incluirShorts).candidatos
}

// ─────────────────────────── leituras do banco ───────────────────────────
interface RespostaBanco { data: unknown; error: unknown }
class FalhaDeLeitura extends Error {
  readonly causa: CausaDaFalha
  readonly codigo?: string
  constructor(porque: string, causa: CausaDaFalha, codigo?: string) {
    super(porque)
    this.name = 'FalhaDeLeitura'
    this.causa = causa
    if (codigo !== undefined) this.codigo = codigo
  }
}
const textoOuNulo = (x: unknown): x is string | null => x === null || typeof x === 'string'

/** Até 5 páginas de 1.000; a sexta com qualquer linha é `cortada`. O texto do erro do banco é descartado. */
async function paginar<T>(
  pagina: (de: number, ate: number) => PromiseLike<RespostaBanco>,
  guarda: (x: unknown) => x is T,
  oQue: string,
): Promise<T[]> {
  const out: T[] = []
  for (let p = 0; p <= PAGINAS; p++) {
    let linhas: T[]
    try {
      const { data, error } = await pagina(p * PAGINA, p * PAGINA + PAGINA - 1)
      if (error) throw new FalhaDeLeitura(`leitura de ${oQue} falhou`, 'erro_do_banco', resumoTecnico(error).sqlstate ?? undefined)
      if (!Array.isArray(data)) throw new FalhaDeLeitura(`${oQue}: resposta fora da forma`, 'forma_invalida')
      if (!data.every(guarda)) throw new FalhaDeLeitura(`${oQue}: linha fora da forma`, 'forma_invalida')
      linhas = data
    } catch (e) {
      if (e instanceof FalhaDeLeitura) throw e
      throw new FalhaDeLeitura(`leitura de ${oQue} lançou`, 'excecao', resumoTecnico(e).sqlstate ?? undefined)
    }
    if (p === PAGINAS) {
      if (linhas.length > 0) throw new FalhaDeLeitura(`${oQue}: mais de ${PAGINAS * PAGINA} linhas`, 'forma_invalida')
      break
    }
    out.push(...linhas)
    if (linhas.length < PAGINA) break
  }
  return out
}

const falhaDoBanco = (porque: string, error: unknown): { porque: string; causa: CausaDaFalha; codigo?: string } => {
  const sqlstate = resumoTecnico(error).sqlstate
  return { porque, causa: 'erro_do_banco', ...(sqlstate !== null ? { codigo: sqlstate } : {}) }
}

const comoLido = <T>(e: unknown): Lido<T> => {
  if (e instanceof FalhaDeLeitura) return { porque: e.message, causa: e.causa, ...(e.codigo !== undefined ? { codigo: e.codigo } : {}) }
  if (e instanceof ErroDeLeitura) return { porque: `lista de candidatos: ${e.codigo}`, causa: 'erro_do_banco' }
  return { porque: 'leitura dos candidatos lançou', causa: 'excecao' }
}

// ─────────────────────────── testes vivos ───────────────────────────
interface LinhaTeste { status: string; created_at: string; updated_at: string | null; youtube_videos: { youtube_video_id: string; site_id: string } }
const eVideoEmbutido = (x: unknown): x is LinhaTeste['youtube_videos'] =>
  isRec(x) && typeof x.youtube_video_id === 'string' && typeof x.site_id === 'string'
const eLinhaTeste = (x: unknown): x is LinhaTeste =>
  isRec(x) && typeof x.status === 'string' && typeof x.created_at === 'string' && textoOuNulo(x.updated_at) && eVideoEmbutido(x.youtube_videos)

export async function lerTestesVivos(sb: SupabaseClient, agoraMs: number): Promise<Lido<TesteVivo[]>> {
  try {
    const linhas = await paginar<LinhaTeste>(
      (de, ate) => sb.from('ab_tests').select('status, created_at, updated_at, youtube_videos!inner(youtube_video_id, site_id)')
        .not('status', 'in', '(completed,archived)').order('created_at').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eLinhaTeste, 'ab_tests',
    )
    const corte = agoraMs - JANELA_DRAFT_DIAS * DIA_MS
    const vistos = new Set<string>()
    const out: TesteVivo[] = []
    for (const l of linhas) {
      if (l.status === 'draft') {
        const c = instante(l.created_at), u = instante(l.updated_at)
        if (!((c !== null && c >= corte) || (u !== null && u >= corte))) continue
      }
      const k = chaveAlvo(l.youtube_videos.site_id, l.youtube_videos.youtube_video_id)
      if (vistos.has(k)) continue
      vistos.add(k)
      out.push({ siteId: l.youtube_videos.site_id, ytId: l.youtube_videos.youtube_video_id })
    }
    return { valor: out }
  } catch (e) {
    return comoLido(e)
  }
}

// ─────────────────────────── próprios antigos (D2) ───────────────────────────
interface LinhaAntigo { youtube_video_id: string; site_id: string; published_at: string | null }
const eLinhaAntigo = (x: unknown): x is LinhaAntigo =>
  isRec(x) && typeof x.youtube_video_id === 'string' && typeof x.site_id === 'string' && textoOuNulo(x.published_at)

async function lerAntigos(sb: SupabaseClient, agoraMs: number): Promise<CandProprio[]> {
  const corte = new Date(agoraMs - JANELA_PROPRIA_DIAS * DIA_MS).toISOString()
  const linhas = await paginar<LinhaAntigo>(
    (de, ate) => sb.from('youtube_videos').select('youtube_video_id, site_id, published_at').lt('published_at', corte)
      .order('published_at', { ascending: false }).order('youtube_video_id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
    eLinhaAntigo, 'youtube_videos',
  )
  return linhas.map(l => ({ id: l.youtube_video_id, ytId: l.youtube_video_id, canalId: '', siteId: l.site_id,
    publishedAt: l.published_at, createdAt: l.published_at ?? '' }))
}

// ─────────────────────────── conciliação ───────────────────────────
interface LinhaAlvoLida { id: number; site_id: string; youtube_video_id: string; hora_base_min: number; saiu_em: string | null }
const eLinhaAlvoLida = (x: unknown): x is LinhaAlvoLida =>
  isRec(x) && typeof x.id === 'number' && typeof x.site_id === 'string' && typeof x.youtube_video_id === 'string'
  && typeof x.hora_base_min === 'number' && textoOuNulo(x.saiu_em)

export interface ResumoConciliar {
  candidatosEsperados: number; alvosAtivos: number; inseridos: number; removidos: number; sites: string[]
  /** Chave `site|yt` dos testes vivos lidos NESTE disparo (Phil I7): é daqui, não do `motivo_ate`, que sai `temTesteNosso`. */
  testesVivos: Set<string>
  /** Ids que o filtro de 11 caracteres jogou fora neste disparo (nunca em silêncio). */
  idsDescartados: number
}

const inteiro = (x: unknown): number | null => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : null)

export async function conciliar(sb: SupabaseClient, agoraMs: number, relatar?: RelatarHoraria): Promise<Lido<ResumoConciliar>> {
  let existentes: LinhaAlvoLida[]
  try {
    existentes = await paginar<LinhaAlvoLida>(
      (de, ate) => sb.from('yt_watch_alvos').select('id, site_id, youtube_video_id, hora_base_min, saiu_em')
        .order('id').range(de, ate).abortSignal(AbortSignal.timeout(BANCO_MS)),
      eLinhaAlvoLida, 'yt_watch_alvos',
    )
  } catch (e) {
    return comoLido(e)
  }
  const lidos = await lerCandidatosDaWatch(sb, agoraMs, relatar)
  if (!('valor' in lidos)) return lidos
  const { candidatos, testesVivos, idsDescartados } = lidos.valor
  const horaDe = new Map<string, number>()
  const horasAtivas: number[] = []
  for (const a of existentes) {
    horaDe.set(chaveAlvo(a.site_id, a.youtube_video_id), a.hora_base_min)
    if (a.saiu_em === null) horasAtivas.push(a.hora_base_min)
  }
  const payload = candidatos.map(c => {
    const k = chaveAlvo(c.siteId, c.ytId)
    let hora = horaDe.get(k)
    if (hora === undefined) {
      hora = faixaMenosCheia(horasAtivas, c.ytId) + 360 * (hash32(c.ytId) % 4)
      horaDe.set(k, hora)
      horasAtivas.push(hora)
    }
    return {
      site_id: c.siteId, youtube_video_id: c.ytId, tipo: c.tipo, motivo_ate: c.motivoAte, coleta_ate: c.coletaAte,
      hora_base_min: hora, rodadas_por_dia: c.rodadasPorDia,
    }
  })

  let resposta: unknown
  try {
    const { data, error } = await sb.rpc('yt_watch_conciliar', { p_agora: new Date(agoraMs).toISOString(), p_candidatos: payload })
      .abortSignal(AbortSignal.timeout(BANCO_MS))
    if (error) {
      relatarSeguro(relatar, 'conciliar_falhou', error)
      return falhaDoBanco('conciliação dos alvos falhou', error)
    }
    resposta = data
  } catch (e) {
    relatarSeguro(relatar, 'conciliar_falhou', e)
    return { porque: 'conciliação dos alvos lançou', causa: 'excecao' }
  }
  const ativos = isRec(resposta) ? inteiro(resposta.alvos_ativos) : null
  if (!isRec(resposta) || ativos === null) return { porque: 'conciliação dos alvos: resposta fora da forma', causa: 'forma_invalida' }
  return {
    valor: {
      candidatosEsperados: candidatos.length,
      alvosAtivos: ativos,
      inseridos: inteiro(resposta.inseridos) ?? 0,
      removidos: inteiro(resposta.removidos) ?? 0,
      sites: [...new Set(candidatos.map(c => c.siteId))],
      testesVivos,
      idsDescartados,
    },
  }
}

// ─────────────────────────── devidos ───────────────────────────
const COLUNAS_DEVIDOS = 'id, site_id, youtube_video_id, hora_base_min, rodadas_por_dia, proxima_rodada_em, coleta_ate, motivo_ate, extensoes_curtas, indisponivel_seguidas, rodadas'
interface LinhaDevida {
  id: number; site_id: string; youtube_video_id: string; hora_base_min: number; rodadas_por_dia: 1 | 4; proxima_rodada_em: string
  coleta_ate: string; motivo_ate: string; extensoes_curtas: number; indisponivel_seguidas: number; rodadas: number
}
const eLinhaDevida = (x: unknown): x is LinhaDevida =>
  isRec(x) && typeof x.id === 'number' && typeof x.site_id === 'string' && typeof x.youtube_video_id === 'string'
  && typeof x.hora_base_min === 'number' && (x.rodadas_por_dia === 1 || x.rodadas_por_dia === 4)
  && typeof x.proxima_rodada_em === 'string' && typeof x.coleta_ate === 'string' && typeof x.motivo_ate === 'string'
  && typeof x.extensoes_curtas === 'number' && typeof x.indisponivel_seguidas === 'number' && typeof x.rodadas === 'number'

export async function lerDevidos(sb: SupabaseClient, agoraMs: number, limite: number): Promise<Lido<AlvoAtivo[]>> {
  try {
    const { data, error } = await sb.from('yt_watch_alvos').select(COLUNAS_DEVIDOS).is('saiu_em', null)
      .lte('proxima_rodada_em', new Date(agoraMs).toISOString()).order('proxima_rodada_em').limit(limite)
      .abortSignal(AbortSignal.timeout(BANCO_MS))
    if (error) return falhaDoBanco('leitura dos alvos devidos falhou', error)
    if (!Array.isArray(data) || !data.every(eLinhaDevida)) return { porque: 'alvos devidos: resposta fora da forma', causa: 'forma_invalida' }
    return {
      valor: data.map(l => ({
        id: l.id, siteId: l.site_id, ytId: l.youtube_video_id, horaBaseMin: l.hora_base_min, rodadasPorDia: l.rodadas_por_dia,
        proximaRodadaEm: l.proxima_rodada_em, coletaAte: l.coleta_ate, motivoAte: l.motivo_ate, extensoesCurtas: l.extensoes_curtas,
        indisponivelSeguidas: l.indisponivel_seguidas, rodadas: l.rodadas, temTesteNosso: false,
      })),
    }
  } catch {
    return { porque: 'leitura dos alvos devidos lançou', causa: 'excecao' }
  }
}

/** `temTesteNosso` vem do `Set` de `conciliar`, nunca de `motivo_ate` (Phil I7). */
export function marcarTesteNosso(alvos: readonly AlvoAtivo[], testesVivos: ReadonlySet<string>): AlvoAtivo[] {
  return alvos.map(a => ({ ...a, temTesteNosso: testesVivos.has(chaveAlvo(a.siteId, a.ytId)) }))
}

/** Os candidatos esperados agora (concorrentes, próprios, testes vivos e antigos) e os testes vivos lidos no mesmo passo. */
export async function lerCandidatosDaWatch(
  sb: SupabaseClient, agoraMs: number, relatar?: RelatarHoraria,
): Promise<Lido<{ candidatos: Candidato[]; testesVivos: Set<string>; idsDescartados: number }>> {
  try {
    const [c, t, a] = await Promise.all([
      lerCandidatos(sb, agoraMs, relatar, JANELA_CONCORRENTE_DIAS),
      lerTestesVivos(sb, agoraMs),
      PROPRIOS_ANTIGOS ? lerAntigos(sb, agoraMs) : Promise.resolve(null),
    ])
    if (!('valor' in t)) return t
    const montados = montarCandidatosContando(c.conc, c.prop, t.valor, a, agoraMs)
    return {
      valor: {
        candidatos: montados.candidatos,
        idsDescartados: montados.descartados,
        testesVivos: new Set(t.valor.map(x => chaveAlvo(x.siteId, x.ytId))),
      },
    }
  } catch (e) {
    return comoLido(e)
  }
}
