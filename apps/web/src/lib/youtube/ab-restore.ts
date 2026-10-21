import { z } from 'zod'

// 403 do Blob não é cota; cota esgotada tem tratamento próprio. Mora aqui (folha) para não haver import circular com youtube-api-error (Y-A6).
export const REASONS_DE_COTA: readonly string[] = ['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded']

export type CampoNome = 'title' | 'thumbnail'
// 'pulado_teste_youtube': escrito pela F1a-dado (settleOnAir, motivo 'teste_youtube'); o CHECK de produção já aceita.
export type EstadoCampo = 'em_andamento' | 'ok' | 'falhou' | 'pulado_sem_original' | 'pulado_drift' | 'desistiu' | 'pulado_teste_youtube'

// Onde o erro aconteceu: a faixa só afirma "o YouTube recusou" para chamada de escrita (F-D10).
export const CHAMADAS_YOUTUBE = ['videos.list', 'videos.update', 'thumbnails.set', 'blob'] as const
export type ChamadaYouTube = (typeof CHAMADAS_YOUTUBE)[number]

// Abortos internos (Y-P2): união dos motivos do brief e dos rulings da varredura.
export const MOTIVOS_INTERNOS = [
  'snippet_sem_descricao',
  'snippet_sem_categoria',
  'titulo_vazio',
  'tempo_esgotado',
  'variante_sem_titulo',
  'arquivo_do_destino_indisponivel',
  'erro_interno',
  'hqdefault_indisponivel',
  'canal_nao_identificado',
  'token',
  'video_fora_de_youtube_videos',
] as const
export type MotivoInterno = (typeof MOTIVOS_INTERNOS)[number]

// { status, reason, chamada }: erro do YouTube/Blob. { motivo }: aborto interno. string: só o 'interrompido' do vigia. Nunca corpo.
export type ErroGravado = string | { status: number; reason: string; chamada?: ChamadaYouTube } | { motivo: string } | null
export interface CampoRestauracao {
  estado: EstadoCampo
  destino: string // 'original' ou o id da variante
  em: string // ISO
  forcado: boolean
  escreveu: boolean | null
  motivo?: string | null // 'sem_base_de_comparacao' | 'video_inexistente' | 'novo_teste'
  erro: ErroGravado
  attempts: number
}
export type RestoreStatus = Partial<Record<CampoNome, CampoRestauracao>>

export const SEM_RESPOSTA_MIN = 5
export const INTERROMPIDO_MIN = 15
const ERRO_MAX = 500

export type LeituraCampo =
  | { tipo: 'em_andamento'; desde: string; destino: string }
  | { tipo: 'sem_resposta'; desde: string; destino: string; interrompido: boolean }
  | { tipo: 'final'; estado: Exclude<EstadoCampo, 'em_andamento'>; em: string; destino: string; forcado: boolean; motivo: string | null }

function idadeEmMin(em: string, agora: Date): number {
  const t = Date.parse(em)
  return Number.isFinite(t) ? (agora.getTime() - t) / 60_000 : Number.POSITIVE_INFINITY
}

export function lerCampoDeRestauracao(campo: CampoRestauracao, agora: Date): LeituraCampo {
  const idadeMin = idadeEmMin(campo.em, agora)
  if (campo.estado === 'falhou' && campo.erro === 'interrompido')
    return { tipo: 'sem_resposta', desde: campo.em, destino: campo.destino, interrompido: true }
  if (campo.estado === 'em_andamento') {
    if (idadeMin <= SEM_RESPOSTA_MIN) return { tipo: 'em_andamento', desde: campo.em, destino: campo.destino }
    return { tipo: 'sem_resposta', desde: campo.em, destino: campo.destino, interrompido: idadeMin > INTERROMPIDO_MIN }
  }
  return { tipo: 'final', estado: campo.estado, em: campo.em, destino: campo.destino, forcado: campo.forcado, motivo: campo.motivo ?? null }
}

/**
 * Regra do vigia (T10/T11, emenda 32): campo em_andamento há mais de 15 min vira
 * falhou/'interrompido', attempts 1, escreveu null, com `em` mantido. Devolve o campo novo,
 * ou null quando não há o que converter (outro estado, ou 15 min exatos / menos).
 * Não muta o campo recebido. `em` ilegível conta como interrompido (idade infinita).
 */
export function converterInterrompido(campo: CampoRestauracao, agora: Date): CampoRestauracao | null {
  if (campo.estado !== 'em_andamento') return null
  if (!(idadeEmMin(campo.em, agora) > INTERROMPIDO_MIN)) return null
  return proximaDoInterrompido(campo)
}

export function lerRestauracao(rs: RestoreStatus | null, agora: Date): Partial<Record<CampoNome, LeituraCampo>> | null {
  if (rs === null) return null
  const out: Partial<Record<CampoNome, LeituraCampo>> = {}
  for (const k of ['title', 'thumbnail'] as const) { const c = rs[k]; if (c) out[k] = lerCampoDeRestauracao(c, agora) }
  return out
}

export function camposDoTeste(testType: 'thumbnail' | 'title' | 'combo'): CampoNome[] {
  return testType === 'combo' ? ['title', 'thumbnail'] : [testType]
}

// string > 500 → 500; objeto mantém só status/reason/chamada (erro do YouTube) ou só motivo (aborto interno).
// Corta em n sem deixar surrogate alto solto (jsonb do Postgres recusa).
function cortar(s: string, n: number): string {
  return s.slice(0, n).replace(/[\uD800-\uDBFF]$/, '')
}

export function truncarErro(e: ErroGravado): ErroGravado {
  if (e === null) return null
  if (typeof e === 'string') return cortar(e, ERRO_MAX)
  if ('status' in e) return { status: e.status, reason: cortar(String(e.reason), 100), ...(e.chamada ? { chamada: e.chamada } : {}) }
  return { motivo: cortar(String(e.motivo), 100) }
}

const Campo = z.object({
  estado: z.enum(['em_andamento', 'ok', 'falhou', 'pulado_sem_original', 'pulado_drift', 'desistiu', 'pulado_teste_youtube']),
  destino: z.string().min(1),
  em: z.string().refine(x => Number.isFinite(Date.parse(x))),
  forcado: z.boolean(),
  escreveu: z.boolean().nullable().optional().transform(v => v ?? null),
  motivo: z.string().nullable().optional(),
  erro: z.union([z.string(), z.object({ status: z.number(), reason: z.string(), chamada: z.enum(CHAMADAS_YOUTUBE).optional() }), z.object({ motivo: z.string() }), z.null()]).optional().transform(v => v ?? null),
  attempts: z.number().int().min(0),
})
const Rs = z.object({ title: Campo.optional(), thumbnail: Campo.optional() })

export function paraRestoreStatus(v: unknown): RestoreStatus | null {
  if (v === null || v === undefined) return null
  const r = Rs.safeParse(v)
  return r.success ? r.data : null
}

export function restoreStatusIlegivel(v: unknown): boolean {
  return v !== null && v !== undefined && !Rs.safeParse(v).success
}

// ---- P4b: regras puras da nova tentativa ----

export const MAX_TENTATIVAS = 3
/** Quantas linhas do histórico a âncora do "sim" lê (as duas consultas e `inicioDoSim`). */
export const LIMITE_DA_CADEIA = 10
export const JANELA_DO_SIM_MS = 48 * 3_600_000

export type MotivoDesistencia = 'video_inexistente' | 'novo_teste' | 'tres_falhas' | 'antes_da_nova_tentativa' | 'destino_invalido'

/** `linhas` por seq decrescente (a mais nova primeiro): devolve o `em` mais antigo da sequência inicial de forcado = true. */
export function inicioDoSim(linhas: ReadonlyArray<{ em: string; forcado: boolean }>): string | null {
  let ancora: string | null = null
  for (const l of linhas) {
    if (!l.forcado) break
    ancora = l.em
  }
  // Y-A2: cadeia cheia e toda forçada = o primeiro "sim" ficou além da leitura; a âncora andaria. Erra para o lado seguro: vencido.
  if (linhas.length >= LIMITE_DA_CADEIA && linhas.every((l) => l.forcado)) return new Date(0).toISOString()
  return ancora
}

export function simAindaVale(campo: CampoRestauracao, agora: Date, inicio?: string | null): boolean {
  if (campo.forcado !== true) return false
  const t = Date.parse(inicio ?? campo.em)
  if (!Number.isFinite(t)) return false
  return agora.getTime() - t < JANELA_DO_SIM_MS
}

export function erroDeCota(erro: ErroGravado): boolean {
  return erro !== null && typeof erro === 'object' && 'reason' in erro && REASONS_DE_COTA.includes(erro.reason)
}

export function proximoDoVigia(
  anterior: number,
  erro: ErroGravado,
  cotaVencida = false,
): { estado: 'falhou' | 'desistiu'; attempts: number; motivo: 'tres_falhas' | null } {
  if (erroDeCota(erro) && !cotaVencida) return { estado: 'falhou', attempts: anterior, motivo: null }
  const n = anterior + 1
  if (n >= MAX_TENTATIVAS) return { estado: 'desistiu', attempts: n, motivo: 'tres_falhas' }
  return { estado: 'falhou', attempts: n, motivo: null }
}

/** Interrompido conta como falha (F1/Y-1): attempts = max(1, p.attempts). */
export function proximaDoInterrompido(campo: CampoRestauracao): CampoRestauracao {
  const p = proximoDoVigia(campo.attempts, 'interrompido')
  return { ...campo, estado: p.estado, erro: 'interrompido', attempts: Math.max(1, p.attempts), escreveu: null, ...(p.motivo ? { motivo: p.motivo } : {}) }
}

export function camposPendentes(rs: RestoreStatus | null, origem: 'vigia' | 'humano'): CampoNome[] {
  if (rs === null) return []
  const out: CampoNome[] = []
  for (const k of ['title', 'thumbnail'] as const) {
    const c = rs[k]
    if (!c) continue
    if (c.estado === 'falhou') out.push(k)
    else if (origem === 'humano' && c.estado === 'desistiu' && c.motivo !== 'novo_teste' && c.motivo !== 'destino_invalido') out.push(k)
  }
  return out
}

export function podeDispensar(c: CampoRestauracao): boolean {
  return c.estado === 'falhou' || c.estado === 'desistiu' || c.estado === 'pulado_drift' || c.estado === 'pulado_sem_original'
}
