// A5 · E5a · Tarefa C1: o leitor dos comentários de destaque de UM vídeo, por nível de quem vê.
// CONTRATO DO CLIENTE: `sb` é o cliente de SERVIÇO. A página chama depois da sua guarda de leitura do site, e o nível vem só das provas
// (`nivelDeQuemVe`). Com o cliente do usuário a RLS devolve zero linha em vez de erro (comentários e marcas só abrem a quem edita; a agenda,
// a `is_member_staff()`), então o leitor RECUSA o que não bate (marco ok com escolhidos e zero comentários) em vez de contar uma história.
// Recebe o cliente por parâmetro (quem chama é a página, depois da guarda dela) e NUNCA lança: o que não foi lido vira
// `{ lido: false, causa, codigo }`. Toda ida ao banco passa por `comTempo` (varredura 3). O erro é classificado por `erro.ts`: nenhum
// `.message`, `.details` nem `.hint` é lido aqui. Sem cache, sem Sentry (quem relata é a página), sem frase: o leitor entrega dado.
//
// DADO PESSOAL: o nível `contagem` não pede `body`, `published_at` nem `youtube_comment_id`, e só o nível `identidade` toca a tabela
// de autores. `channel_id` do autor nunca é pedido.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFINICAO_RETRATOS_COMENTARIOS } from '@/lib/youtube/agenda/definicoes'
import { tarefaViva } from '../medidas-telas/tarefa-viva'
import type { CausaNaoLida } from '../medidas/ler'
import { codigoDe } from './erro'
import { comTempo, ehSchemaAusente } from './gravar'
import { nivelDeQuemVe, semMencoes } from './leitor-nivel'
import type {
  AutorComIdentidade, CartaoBase, CartaoIdentidade, CartaoTexto, ComentariosDoVideo, CurtidasNoMarco, EstadoDoMarco, Faixas,
  MotivoDoCartao, ParteLida, ProvasDeQuemVe, ResumoDoMarco,
} from './leitor-tipos'
import { COMMENT_RULES } from './regras'
import type { Marco } from './tipos'

export const MARCOS: readonly Marco[] = [1, 7, 30]
export const BLOCO = 150
export const PAGINA = 1000
const HORA_MS = 3_600_000

export type Obj = Record<string, unknown>
export const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
type Resposta = Awaited<ReturnType<typeof comTempo>>

/** Resposta fora da forma esperada: a parte inteira fica não lida, nunca se pula uma linha em silêncio. */
export class ForaDaForma extends Error {
  constructor() { super('leitor: fora da forma') ; this.name = 'ForaDaForma' }
}

export function naoLida(causa: CausaNaoLida, codigo: string): { lido: false; causa: CausaNaoLida; codigo: string } {
  return { lido: false, causa, codigo }
}
/** A causa de uma exceção ou erro do banco, sem texto: schema ausente (a migration não foi aplicada) ou erro do banco. */
export function naoLidaPorErro(err: unknown): { lido: false; causa: CausaNaoLida; codigo: string } {
  if (err instanceof ForaDaForma) return naoLida('erro_do_banco', 'forma_inesperada')
  return naoLida(ehSchemaAusente(err) ? 'schema_ausente' : 'erro_do_banco', codigoDe(err))
}

/** As linhas de uma resposta, ou lança o erro do banco (que o chamador converte em parte não lida). */
export function linhasDe(r: Resposta): Obj[] {
  if (r.error !== null && r.error !== undefined) throw r.error
  if (!Array.isArray(r.data)) throw new ForaDaForma()
  const saida: Obj[] = []
  for (const x of r.data) {
    if (!ehObj(x)) throw new ForaDaForma()
    saida.push(x)
  }
  return saida
}
export function cortada(linhas: Obj[]): boolean { return linhas.length >= PAGINA }
/** Teto de voltas da paginação por chave (`id`): acima disso a parte fica não lida (`ForaDaForma`) em vez de rodar sem fim. */
export const VOLTAS_MAX = 20
/** O `id` da última linha de uma página cheia (para pedir a próxima com `.gt('id', …)`); nulo quando a página veio incompleta (acabou). */
export function depoisDe(pagina: Obj[]): string | null {
  if (pagina.length < PAGINA) return null
  const ultima = pagina[pagina.length - 1]
  if (ultima === undefined) throw new ForaDaForma()
  const id = ultima.id
  if (typeof id === 'number' && Number.isInteger(id)) return String(id)
  if (typeof id === 'string' && /^\d+$/.test(id)) return id
  throw new ForaDaForma()
}

// ───── guardas de tipo, uma por campo ─────
export function txt(v: unknown): string { if (typeof v !== 'string') throw new ForaDaForma(); return v }
export function txtOuNulo(v: unknown): string | null { if (v === null || v === undefined) return null; return txt(v) }
export function bool(v: unknown): boolean { if (typeof v !== 'boolean') throw new ForaDaForma(); return v }
export function boolOuNulo(v: unknown): boolean | null { if (v === null || v === undefined) return null; return bool(v) }
export function num(v: unknown): number {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ForaDaForma()
  return n
}
export function numOuNulo(v: unknown): number | null { if (v === null || v === undefined) return null; return num(v) }
export function msDe(v: unknown): number {
  const t = Date.parse(txt(v))
  if (Number.isNaN(t)) throw new ForaDaForma()
  return t
}
export function msOuNulo(v: unknown): number | null { if (v === null || v === undefined) return null; return msDe(v) }
export function marcoDe(v: unknown): Marco | null {
  const n = num(v)
  return n === 1 || n === 7 || n === 30 ? n : null
}
export function blocos<T>(xs: readonly T[], tam = BLOCO): T[][] {
  const saida: T[][] = []
  for (let i = 0; i < xs.length; i += tam) saida.push(xs.slice(i, i + tam))
  return saida
}

// ───── a agenda: o último ok e a primeira execução da tarefa (do banco inteiro: a agenda não tem site) ─────
export interface DaAgenda { ultimoOkMs: number | null; primeiraExecucaoMs: number | null }

export async function lerAgenda(sb: SupabaseClient): Promise<DaAgenda> {
  const tarefa = DEFINICAO_RETRATOS_COMENTARIOS.nome
  const [ok, primeira] = await Promise.all([
    comTempo((sinal) => sb.from('competitor_agenda_runs').select('finished_at').eq('task', tarefa).eq('status', 'ok')
      .order('finished_at', { ascending: false }).limit(1).abortSignal(sinal)),
    comTempo((sinal) => sb.from('competitor_agenda_runs').select('started_at').eq('task', tarefa)
      .order('started_at', { ascending: true }).limit(1).abortSignal(sinal)),
  ])
  const a = linhasDe(ok)
  const b = linhasDe(primeira)
  return { ultimoOkMs: a[0] ? msOuNulo(a[0].finished_at) : null, primeiraExecucaoMs: b[0] ? msOuNulo(b[0].started_at) : null }
}

/** A tolerância é sempre a da definição da tarefa: nenhum número escrito aqui. */
export function viva(a: DaAgenda, agoraMs: number): ReturnType<typeof tarefaViva> {
  return tarefaViva({ ultimoOkMs: a.ultimoOkMs, primeiraExecucaoMs: a.primeiraExecucaoMs, toleranciaH: DEFINICAO_RETRATOS_COMENTARIOS.toleranciaVigiaH, agoraMs })
}

// ───── o retrato de cada marco ─────
interface Snap {
  mark: Marco
  status: 'ok' | 'sem_comentarios' | 'desligados' | 'erro'
  /** O `error_reason` gravado pela coleta (só no `erro`). */
  motivo: string | null
  tomadoEmMs: number
  idadeHoras: number
  amostra: number | null
  amostraCompleta: boolean | null
  totalDoDia: number | null
  escolhidos: number | null
  autoresConsultados: number | null
  autoresSemTamanho: number | null
}
const STATUS = new Set(['ok', 'sem_comentarios', 'desligados', 'erro'])

function snapDe(x: Obj): Snap | null {
  const mark = marcoDe(x.mark)
  if (mark === null) return null
  const status = txt(x.status)
  if (!STATUS.has(status)) throw new ForaDaForma()
  return {
    mark, status: status as Snap['status'], motivo: txtOuNulo(x.error_reason), tomadoEmMs: msDe(x.taken_at), idadeHoras: num(x.video_age_hours),
    amostra: numOuNulo(x.pool_size), amostraCompleta: boolOuNulo(x.pool_complete), totalDoDia: numOuNulo(x.video_comment_count),
    escolhidos: numOuNulo(x.selected_count), autoresConsultados: numOuNulo(x.featured_lookup_n), autoresSemTamanho: numOuNulo(x.featured_unknown_n),
  }
}

export interface DoVideo { t0Ms: number; descobertoEmMs: number | null; canalId: string }

function estadoDoMarco(
  mark: Marco, snap: Snap | undefined, v: DoVideo, agoraMs: number, primeiroRetratoMs: number | null, agenda: DaAgenda,
): EstadoDoMarco {
  const regra = COMMENT_RULES.marks.find((m) => m.mark === mark)
  if (regra === undefined) throw new ForaDaForma()
  const fromMs = v.t0Ms + regra.fromH * HORA_MS
  const untilMs = v.t0Ms + regra.untilH * HORA_MS
  if (snap !== undefined) {
    if (snap.status === 'sem_comentarios') return { estado: 'sem_comentarios', tomadoEmMs: snap.tomadoEmMs }
    if (snap.status === 'desligados') return { estado: 'desligados', tomadoEmMs: snap.tomadoEmMs }
    const encerrada = agoraMs > untilMs
    const listaVazia = (): EstadoDoMarco => ({
      estado: 'nao_coletado', porque: { causa: 'lista_vazia', tomadoEmMs: snap.tomadoEmMs, ateMs: untilMs, encerrada, totalDoDia: snap.totalDoDia },
    })
    // A coleta grava a lista vazia com contagem positiva como `erro` + `lista_vazia_com_contagem` (coletar.ts); `ok` com 0 escolhidos é só defesa.
    if (snap.status === 'erro') {
      if (snap.motivo === 'lista_vazia_com_contagem') return listaVazia()
      return {
        estado: 'nao_coletado',
        porque: { causa: 'erro', tentouEmMs: snap.tomadoEmMs, ateMs: untilMs, encerrada, codigo: snap.motivo ?? 'sem_codigo', totalDoDia: snap.totalDoDia },
      }
    }
    if (snap.escolhidos === 0) return listaVazia()
    const resumo: ResumoDoMarco = {
      tomadoEmMs: snap.tomadoEmMs, idadeHoras: snap.idadeHoras, amostra: snap.amostra, amostraCompleta: snap.amostraCompleta,
      totalDoDia: snap.totalDoDia, escolhidos: snap.escolhidos, autoresConsultados: snap.autoresConsultados, autoresSemTamanho: snap.autoresSemTamanho,
    }
    return { estado: 'ok', resumo }
  }
  // sem linha: decide antes de tudo, e sem chamar `tarefaViva`, que a coleta nem começou
  if (primeiroRetratoMs === null) return { estado: 'coleta_nao_comecou' }
  if (agoraMs > untilMs) {
    if (untilMs < primeiroRetratoMs) return { estado: 'antes_da_coleta', coletaDesdeMs: primeiroRetratoMs }
    if (v.descobertoEmMs !== null && v.descobertoEmMs > untilMs) return { estado: 'nao_coletado', porque: { causa: 'tarde' } }
    return { estado: 'nao_coletado', porque: { causa: 'janela_perdida' } }
  }
  const t = viva(agenda, agoraMs)
  if (t.estado === 'nao_lida') throw new ForaDaForma()
  if (t.estado === 'parada') return { estado: 'coleta_parada', desdeMs: t.desdeMs, semOk: t.semOk }
  if (agoraMs < fromMs) return { estado: 'fecha_em', fechaEmMs: fromMs }
  return { estado: 'a_caminho', fezEmMs: fromMs, ateMs: untilMs }
}

// ───── o leitor ─────
export interface PedidoDeComentarios {
  siteDaGuarda: string
  provas: ProvasDeQuemVe | null
  videoId: string
  agoraMs: number
  canaisDoSite: ReadonlyMap<string, { nome: string }>
  /** O que a página já sabe do vídeo (achado em `obs.videos` por quem chama): a idade conta de t0 e o canal dá o nome do criador. */
  video: DoVideo
}

const COLUNAS_SNAP = 'mark, status, error_reason, taken_at, video_age_hours, pool_size, pool_complete, video_comment_count, selected_count, featured_lookup_n, featured_unknown_n'
const COLUNAS_COMENTARIO = 'id, parent_id, is_creator, creator_replied, featured_reason, featured_size_band, featured_ratio_band, missing_since'
const COLUNAS_COMENTARIO_TEXTO = COLUNAS_COMENTARIO + ', body, body_truncated, published_at, first_seen_at, author_purged_at'
const COLUNAS_MARCA = 'comment_id, mark, likes, reply_count, slot, creator_replied, relevance_rank'
const COLUNAS_AUTOR = 'comment_id, display_name, avatar_url, expires_at'

interface Comentario {
  id: string
  parentId: string | null
  isCreator: boolean
  criadorRespondeu: boolean | null
  motivo: string | null
  faixas: Faixas
  saiuDesde: string | null
  texto: string | null
  cortado: boolean
  publicadoMs: number | null
  purgadoEm: string | null
}
interface Marca { mark: Marco; likes: number; respostas: number | null; slot: string | null; posicao: number | null }
interface Autor { nome: string | null; foto: string | null; expiraMs: number; expiraEm: string }

const idDe = (v: unknown): string => {
  if (typeof v === 'number' && Number.isInteger(v)) return String(v)
  if (typeof v === 'string' && /^\d+$/.test(v)) return v
  throw new ForaDaForma()
}
const idOuNulo = (v: unknown): string | null => (v === null || v === undefined ? null : idDe(v))

function comentarioDe(x: Obj, comTexto: boolean): Comentario {
  return {
    id: idDe(x.id), parentId: idOuNulo(x.parent_id), isCreator: bool(x.is_creator), criadorRespondeu: boolOuNulo(x.creator_replied),
    motivo: txtOuNulo(x.featured_reason), faixas: { tamanho: txtOuNulo(x.featured_size_band), razao: txtOuNulo(x.featured_ratio_band) },
    saiuDesde: txtOuNulo(x.missing_since),
    texto: comTexto ? txt(x.body) : null, cortado: comTexto ? bool(x.body_truncated) : false,
    publicadoMs: comTexto ? msDe(x.published_at) : null, purgadoEm: comTexto ? txtOuNulo(x.author_purged_at) : null,
  }
}

export async function lerComentariosDeDestaque(sb: SupabaseClient, p: PedidoDeComentarios): Promise<ParteLida<ComentariosDoVideo>> {
  try {
    return { lido: true, dados: await ler(sb, p) }
  } catch (e) {
    return naoLidaPorErro(e)
  }
}

async function ler(sb: SupabaseClient, p: PedidoDeComentarios): Promise<ComentariosDoVideo> {
  const { nivel, siteId } = nivelDeQuemVe(p.provas, p.siteDaGuarda)
  const comTexto = nivel !== 'contagem'
  const colunas = comTexto ? COLUNAS_COMENTARIO_TEXTO : COLUNAS_COMENTARIO

  const [rSnaps, rComentarios, rPrimeiro, agenda] = await Promise.all([
    comTempo((sinal) => sb.from('competitor_video_comment_snaps').select(COLUNAS_SNAP).eq('site_id', siteId).eq('video_id', p.videoId)
      .in('mark', [...MARCOS]).abortSignal(sinal)),
    comTempo((sinal) => sb.from('competitor_video_comments').select(colunas).eq('site_id', siteId).eq('video_id', p.videoId)
      .limit(PAGINA).abortSignal(sinal)),
    comTempo((sinal) => sb.from('competitor_video_comment_snaps').select('taken_at').eq('site_id', siteId)
      .order('taken_at', { ascending: true }).limit(1).abortSignal(sinal)),
    lerAgenda(sb),
  ])
  const snaps = new Map<Marco, Snap>()
  for (const x of linhasDe(rSnaps)) { const s = snapDe(x); if (s !== null) snaps.set(s.mark, s) }
  const brutos = linhasDe(rComentarios)
  if (cortada(brutos)) throw new ForaDaForma()
  const comentarios = brutos.map((x) => comentarioDe(x, comTexto))
  const primeiro = linhasDe(rPrimeiro)
  const primeiroRetratoMs = primeiro[0] ? msDe(primeiro[0].taken_at) : null

  const marcos = {} as Record<Marco, EstadoDoMarco>
  for (const m of MARCOS) marcos[m] = estadoDoMarco(m, snaps.get(m), p.video, p.agoraMs, primeiroRetratoMs, agenda)

  const topo = comentarios.filter((c) => c.parentId === null)
  const filhos = new Map<string, Comentario[]>()
  for (const c of comentarios) {
    if (c.parentId === null) continue
    const lista = filhos.get(c.parentId)
    if (lista === undefined) filhos.set(c.parentId, [c])
    else lista.push(c)
  }

  // as leituras por comentário de topo
  const marcas = new Map<string, Map<Marco, Marca>>()
  for (const bloco of blocos(topo.map((c) => c.id))) {
    const r = await comTempo((sinal) => sb.from('competitor_video_comment_marks').select(COLUNAS_MARCA).eq('site_id', siteId)
      .in('comment_id', bloco).abortSignal(sinal))
    for (const x of linhasDe(r)) {
      const mark = marcoDe(x.mark)
      if (mark === null) continue
      const id = idDe(x.comment_id)
      const doComentario = marcas.get(id) ?? new Map<Marco, Marca>()
      doComentario.set(mark, { mark, likes: num(x.likes), respostas: numOuNulo(x.reply_count), slot: txtOuNulo(x.slot), posicao: numOuNulo(x.relevance_rank) })
      marcas.set(id, doComentario)
    }
  }

  // Coerência com o cliente: retrato ok com escolhidos e nenhum comentário com vaga naquele marco = leitura incompleta (cliente sem RLS
  // de leitura, ou retrato e comentários fora de sincronia). Nunca vira "lista vazia".
  for (const m of MARCOS) {
    const s = snaps.get(m)
    if (s === undefined || s.status !== 'ok' || s.escolhidos === null || s.escolhidos <= 0) continue
    if (!topo.some((c) => (marcas.get(c.id)?.get(m)?.slot ?? null) !== null)) throw new ForaDaForma()
  }

  // a identidade: só o nível `identidade` toca a tabela de autores
  const autores = new Map<string, Autor>()
  if (nivel === 'identidade') {
    for (const bloco of blocos(topo.filter((c) => !c.isCreator).map((c) => c.id))) {
      const r = await comTempo((sinal) => sb.from('competitor_video_comment_authors').select(COLUNAS_AUTOR).eq('site_id', siteId)
        .in('comment_id', bloco).abortSignal(sinal))
      for (const x of linhasDe(r)) {
        autores.set(idDe(x.comment_id), { nome: txtOuNulo(x.display_name), foto: txtOuNulo(x.avatar_url), expiraMs: msDe(x.expires_at), expiraEm: txt(x.expires_at) })
      }
    }
  }

  const nomeDoCriador = p.canaisDoSite.get(p.video.canalId)?.nome ?? null
  const escolhidos = topo
    .map((c) => ({ c, doComentario: marcas.get(c.id) ?? new Map<Marco, Marca>() }))
    .map((x) => ({ ...x, nos: MARCOS.filter((m) => (x.doComentario.get(m)?.slot ?? null) !== null) }))
    .filter((x) => x.nos.length > 0)
  const entrada = (x: (typeof escolhidos)[number]): Marco => x.nos[0] as Marco
  const curtidasNaEntrada = (x: (typeof escolhidos)[number]): number => x.doComentario.get(entrada(x))?.likes ?? -1
  escolhidos.sort((a, b) => entrada(a) - entrada(b) || curtidasNaEntrada(b) - curtidasNaEntrada(a) || Number(BigInt(a.c.id) - BigInt(b.c.id)))

  const base = (x: (typeof escolhidos)[number], ordem: number): CartaoBase & { _c: Comentario } => {
    const curtidas = {} as Record<Marco, CurtidasNoMarco>
    for (const m of MARCOS) {
      const retratoOk = snaps.get(m)?.status === 'ok'
      const marca = x.doComentario.get(m)
      curtidas[m] = !retratoOk ? 'ainda_nao' : marca === undefined ? 'fora_dos_12' : marca.likes
    }
    const ultima = [...MARCOS].reverse().map((m) => x.doComentario.get(m)).find((m) => m !== undefined && m.respostas !== null)
    const slot = x.doComentario.get(entrada(x))?.slot ?? null
    const motivo: MotivoDoCartao = slot === 'criador' ? 'criador'
      : slot === 'destaque' && (x.c.motivo === 'canal_acompanhado' || x.c.motivo === 'inscritos' || x.c.motivo === 'canal_proprio') ? x.c.motivo
        : 'curtidos'
    return {
      ordem, motivo, curtidas, respostas: ultima?.respostas ?? null,
      criador: x.c.criadorRespondeu === true ? 'respondeu' : x.c.criadorRespondeu === false ? 'nao_vimos' : 'nao_sabemos',
      posicao: { 1: x.doComentario.get(1)?.posicao ?? null, 7: x.doComentario.get(7)?.posicao ?? null, 30: x.doComentario.get(30)?.posicao ?? null },
      criadorNome: nomeDoCriador, doCriador: x.c.isCreator, entrouNoMarco: entrada(x), nosMarcos: x.nos, saiuDoYouTubeDesde: x.c.saiuDesde,
      faixas: x.c.faixas, _c: x.c,
    }
  }

  if (nivel === 'contagem') {
    const lista = escolhidos.map((x, i) => { const { _c, ...cartao } = base(x, i + 1); void _c; return cartao })
    return { nivel, marcos, comentarios: lista }
  }

  const cartaoTexto = (x: (typeof escolhidos)[number], ordem: number, comIdentidade: AutorComIdentidade | null): CartaoTexto | CartaoIdentidade => {
    const { _c: c, ...cartao } = base(x, ordem)
    const protegido = comIdentidade === null || comIdentidade.tipo !== 'com_identidade'
    let trocadas = 0
    const passar = (t: string): string => {
      if (!protegido) return t
      const r = semMencoes(t)
      trocadas += r.trocadas
      return r.texto
    }
    const respostasDoCriador = (filhos.get(c.id) ?? [])
      .filter((f) => f.saiuDesde === null) // a resposta que saiu do YouTube nunca entra
      .sort((a, b) => (a.publicadoMs ?? 0) - (b.publicadoMs ?? 0) || Number(BigInt(a.id) - BigInt(b.id)))
      .slice(0, COMMENT_RULES.creatorRepliesMax)
      .map((f) => ({ texto: passar(f.texto ?? ''), cortado: f.cortado }))
    const texto = passar(c.texto ?? '')
    const autor = comIdentidade ?? (c.isCreator ? { tipo: 'criador' as const } : c.motivo === 'inscritos' ? { tipo: 'canal_grande' as const } : { tipo: 'espectador' as const })
    return { ...cartao, texto, cortado: c.cortado, publicadoEm: new Date(c.publicadoMs ?? 0).toISOString(), respostasDoCriador, autor, mencoesTrocadas: trocadas }
  }

  if (nivel === 'texto') {
    return { nivel, marcos, comentarios: escolhidos.map((x, i) => cartaoTexto(x, i + 1, null) as CartaoTexto) }
  }
  const lista = escolhidos.map((x, i): CartaoIdentidade => {
    const a = autores.get(x.c.id)
    const valida = a !== undefined && a.expiraMs > p.agoraMs && x.c.purgadoEm === null && a.nome !== null && a.nome !== '' && !x.c.isCreator
    const identidade: AutorComIdentidade | null = valida
      ? { tipo: 'com_identidade', nome: a.nome as string, fotoUrl: a.foto, guardadaAte: a.expiraEm }
      : x.c.isCreator ? { tipo: 'criador' } : x.c.motivo === 'inscritos' ? { tipo: 'canal_grande' } : { tipo: 'espectador' }
    return cartaoTexto(x, i + 1, identidade) as CartaoIdentidade
  })
  return { nivel, marcos, comentarios: lista }
}
