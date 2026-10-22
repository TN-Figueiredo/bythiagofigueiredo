// Ficha "Testar no YouTube" gravada no servidor (§5.3): abrir, salvar (CAS), "Abrir no Studio", "Lembrar no computador".
// Núcleo com portas (cliente de banco e `createNotification` injetáveis); a action fina vive em `ab-lab/actions-nativo.ts`.
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { eUrlDaFicha } from '@/lib/youtube/teste-youtube/nativo/imagem-ficha'
import { contarCaracteresDoTitulo, LIMITE_TITULO } from '@/lib/youtube/teste-youtube/nativo/titulo'
import { createNotification } from '@/lib/notifications/create'

/** Janela de "ficha enviada": o Studio aberto ou o lembrete pedido nos últimos 14 dias. */
export const JANELA_FICHA_ENVIADA_DIAS = 14
const DIA_MS = 86_400_000
export const MSG_NAO_ENCONTRADO = 'não encontrado'
export const MSG_FICHA_MUDOU = 'A ficha mudou em outro lugar. Recarregamos a versão atual.'

export const ORIGENS_IMAGEM = ['teste_nosso', 'retrato_diario', 'ytimg'] as const
export type OrigemImagem = (typeof ORIGENS_IMAGEM)[number]

export const VarianteFichaSchema = z.object({
  n: z.number().int().min(1).max(3),
  tipo: z.enum(['titulo', 'miniatura', 'combo']),
  titulo: z.string().trim().min(1).refine((t) => contarCaracteresDoTitulo(t) <= LIMITE_TITULO, `título acima de ${LIMITE_TITULO} caracteres`).optional(),
  imagem: z.object({
    url: z.string().url().refine(eUrlDaFicha, 'a imagem precisa ser uma cópia da ficha no Blob'),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    largura: z.number().int().positive(),
    altura: z.number().int().positive(),
    origem: z.enum(ORIGENS_IMAGEM).optional(),
    capturada_em: z.string().datetime({ offset: true }).optional(),
  }).strict().optional(),
}).strict()
export type VarianteFicha = z.infer<typeof VarianteFichaSchema>

export const FichaRascunhoSchema = z.object({
  campos: z.array(z.enum(['titulo', 'miniatura'])).max(2).refine((c) => new Set(c).size === c.length, 'campos repetidos'),
  variantes: z.array(VarianteFichaSchema).max(3),
}).strict().superRefine((f, ctx) => {
  if (new Set(f.variantes.map((v) => v.n)).size !== f.variantes.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'n repetido', path: ['variantes'] })
})
export type FichaRascunho = z.infer<typeof FichaRascunhoSchema>

/** Linha de `ab_native_fichas` como o PostgREST a devolve (timestamps em texto, usados cru no CAS). */
export interface FichaLinha {
  id: string; site_id: string; video_id: string
  campos: string[]; variantes: VarianteFicha[]
  criada_em: string; criada_por: string | null; atualizada_em: string
  studio_aberto_em: string | null; lembrar_em: string | null; descartada_em: string | null; registro_id: string | null
}
export interface FichaLida extends FichaLinha { aberta: boolean; enviada: boolean }

/** `aberta` e `enviada` derivados: sem coluna de status. `greatest` ignora nulos (com `coalesce`, Studio há 20 d e lembrete ontem sumiria a ficha). */
export function derivarFicha(l: FichaLinha, agora: Date): FichaLida {
  const aberta = l.registro_id === null && l.descartada_em === null
  const marcas = [l.studio_aberto_em, l.lembrar_em].filter((x): x is string => x !== null).map((x) => Date.parse(x)).filter((x) => !Number.isNaN(x))
  const ultima = marcas.length > 0 ? Math.max(...marcas) : null
  const enviada = aberta && ultima !== null && ultima >= agora.getTime() - JANELA_FICHA_ENVIADA_DIAS * DIA_MS
  return { ...l, aberta, enviada }
}

export type ResultadoFicha = { ok: true; ficha: FichaLida } | { ok: false; error: string; fichaAtual?: FichaLida }
interface Base { sb: SupabaseClient; siteId: string; agora?: () => Date }
const hoje = (b: Base): Date => (b.agora ?? (() => new Date()))()

async function lerFicha(sb: SupabaseClient, siteId: string, fichaId: string): Promise<FichaLinha | null> {
  const { data, error } = await sb.from('ab_native_fichas').select('*').eq('id', fichaId).eq('site_id', siteId).maybeSingle()
  if (error) throw new Error(`ab_native_fichas: ${error.message}`)
  return (data as FichaLinha | null) ?? null
}

/** Abre (ou cria) a ficha do vídeo pela função de banco (atomicidade e descarte da inativa). Vídeo de outro site ou inexistente: "não encontrado". */
export async function abrirFichaCore(p: Base & { userId: string; videoId: string }): Promise<ResultadoFicha> {
  const { data, error } = await p.sb.rpc('ab_native_ficha_abrir', { p_site: p.siteId, p_video: p.videoId, p_usuario: p.userId })
  if (error) {
    if ((error as { code?: string }).code === '23503') return { ok: false, error: MSG_NAO_ENCONTRADO }
    throw new Error(`ab_native_ficha_abrir: ${error.message}`)
  }
  const linha = (Array.isArray(data) ? data[0] : data) as FichaLinha | null
  if (!linha || typeof linha.id !== 'string') throw new Error('ab_native_ficha_abrir: sem ficha aberta (corrida); tente de novo')
  return { ok: true, ficha: derivarFicha(linha, hoje(p)) }
}

/** Grava campos e variantes sob CAS por `atualizada_em`: quem perde recebe a ficha atual e nada é sobrescrito. */
export async function salvarFichaCore(p: Base & { fichaId: string; lido: string; dados: unknown }): Promise<ResultadoFicha> {
  const v = FichaRascunhoSchema.safeParse(p.dados)
  if (!v.success) return { ok: false, error: v.error.issues.map((i) => `${i.path.join('.') || 'ficha'}: ${i.message}`).join('; ') }
  const { data, error } = await p.sb.from('ab_native_fichas')
    .update({ campos: v.data.campos, variantes: v.data.variantes })
    .eq('id', p.fichaId).eq('site_id', p.siteId).eq('atualizada_em', p.lido)
    .is('registro_id', null).is('descartada_em', null)
    .select('*')
  if (error) throw new Error(`ab_native_fichas: ${error.message}`)
  const gravada = (data as FichaLinha[] | null)?.[0]
  if (gravada) return { ok: true, ficha: derivarFicha(gravada, hoje(p)) }
  const atual = await lerFicha(p.sb, p.siteId, p.fichaId)
  if (!atual) return { ok: false, error: MSG_NAO_ENCONTRADO }
  return { ok: false, error: MSG_FICHA_MUDOU, fichaAtual: derivarFicha(atual, hoje(p)) }
}

/** "Abrir no Studio": marca `studio_aberto_em` (a ficha vira "enviada"). */
export async function marcarStudioAbertoCore(p: Base & { fichaId: string }): Promise<ResultadoFicha> {
  const { data, error } = await p.sb.from('ab_native_fichas')
    .update({ studio_aberto_em: hoje(p).toISOString() })
    .eq('id', p.fichaId).eq('site_id', p.siteId).is('registro_id', null).is('descartada_em', null)
    .select('*')
  if (error) throw new Error(`ab_native_fichas: ${error.message}`)
  const linha = (data as FichaLinha[] | null)?.[0]
  if (linha) return { ok: true, ficha: derivarFicha(linha, hoje(p)) }
  const atual = await lerFicha(p.sb, p.siteId, p.fichaId)
  if (!atual) return { ok: false, error: MSG_NAO_ENCONTRADO }
  return { ok: false, error: MSG_FICHA_MUDOU, fichaAtual: derivarFicha(atual, hoje(p)) }
}

export type ResultadoLembrar = { ok: true; lembrarEm: string; jaLembrado: boolean } | { ok: false; error: string }

/**
 * "Lembrar no computador": notificação do sistema para quem tocou (`dedup_key` por ficha) e `lembrar_em`.
 * A notificação existir sem `lembrar_em` (a gravação caiu) é reparado no 2º toque: a deduplicação responde "suprimida" e `lembrar_em` é gravado.
 */
export async function lembrarNoComputadorCore(p: Base & { userId: string; fichaId: string; criar?: typeof createNotification }): Promise<ResultadoLembrar> {
  const ficha = await lerFicha(p.sb, p.siteId, p.fichaId)
  if (!ficha || ficha.registro_id !== null || ficha.descartada_em !== null) return { ok: false, error: MSG_NAO_ENCONTRADO }
  if (ficha.lembrar_em) return { ok: true, lembrarEm: ficha.lembrar_em, jaLembrado: true }

  const { data: video, error: erroVideo } = await p.sb.from('youtube_videos').select('youtube_video_id, title').eq('id', ficha.video_id).eq('site_id', p.siteId).maybeSingle()
  if (erroVideo) throw new Error(`youtube_videos: ${erroVideo.message}`)
  const lido = video as { youtube_video_id: string; title: string | null } | null
  const yt = lido?.youtube_video_id
  if (!yt) return { ok: false, error: MSG_NAO_ENCONTRADO }

  const r = await (p.criar ?? createNotification)({
    site_id: p.siteId, user_id: p.userId, domain: 'youtube', type: 'youtube.native_ficha_lembrar', priority: 3,
    title: 'Abrir a ficha no computador',
    message: `${lido?.title ?? ''}. Ficha do teste do YouTube salva no celular.`.replace(/^\. /, ''),
    dedup_key: `ficha-lembrar:${ficha.id}`,
    payload: { ficha_id: ficha.id, video_id: ficha.video_id },
    action_href: `/cms/youtube/ab-lab?video=${yt}`,
  })
  if (!r.success) return { ok: false, error: r.error ?? 'não foi possível criar o lembrete' }

  const lembrarEm = hoje(p).toISOString()
  const { data, error } = await p.sb.from('ab_native_fichas').update({ lembrar_em: lembrarEm })
    .eq('id', ficha.id).eq('site_id', p.siteId).is('lembrar_em', null).is('registro_id', null).is('descartada_em', null).select('lembrar_em')
  if (error) return { ok: false, error: `não foi possível gravar o lembrete: ${error.message}` }
  const gravado = (data as Array<{ lembrar_em: string }> | null)?.[0]?.lembrar_em
  if (gravado) return { ok: true, lembrarEm: gravado, jaLembrado: r.suppressed === true }
  // Outro toque gravou na frente: devolve a data que ficou.
  const atual = await lerFicha(p.sb, p.siteId, ficha.id)
  return atual?.lembrar_em ? { ok: true, lembrarEm: atual.lembrar_em, jaLembrado: true } : { ok: false, error: MSG_NAO_ENCONTRADO }
}
