// Ficha "Testar no YouTube" gravada no servidor (§5.3): abrir, salvar (CAS), "Abrir no Studio", "Lembrar no computador".
// Núcleo com portas (cliente de banco e `createNotification` injetáveis); a action fina vive em `ab-lab/actions-nativo.ts`.
import { lerRetratoDoEditor } from '@/lib/youtube/observatorio/proprio/ler-retrato-ficha'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { eUrlDaFicha } from '@/lib/youtube/teste-youtube/nativo/ficha-url'
import { contarCaracteresDoTitulo, LIMITE_TITULO } from '@/lib/youtube/teste-youtube/nativo/titulo'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { createNotification } from '@/lib/notifications/create'
import { INATIVIDADE_DESCARTE_MS, ultimaAtividade } from '@/lib/youtube/teste-youtube/nativo/ficha-tela'

/** Janela de "ficha enviada": o Studio aberto ou o lembrete pedido nos últimos 14 dias. */
export const JANELA_FICHA_ENVIADA_DIAS = 14
const DIA_MS = 86_400_000
export const MSG_NAO_ENCONTRADO = 'não encontrado'
export const MSG_FICHA_MUDOU: string = FRASES.mudouEmOutroLugar

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

/**
 * Título da versão A (`n=1`), resolvido no servidor (Phil C4, Yannis C4): variante `is_original` do teste nosso corrente
 * → `title_at_capture` do último retrato diário sem variante → `youtube_videos.title`. `null` quando nenhuma fonte tem texto.
 */
export async function resolverTituloOriginal(sb: SupabaseClient, siteId: string, videoId: string): Promise<string | null> {
  const { data: vid, error: eVid } = await sb.from('youtube_videos').select('youtube_video_id, title').eq('id', videoId).eq('site_id', siteId).maybeSingle()
  if (eVid) throw new Error(`youtube_videos: ${eVid.message}`)
  const v = vid as { youtube_video_id: string; title: string | null } | null
  if (!v) return null
  // `ab_tests.youtube_video_id` é o UUID de `youtube_videos.id` (não o ID de texto do YouTube): Gio F-4.
  const texto = (t: string | null | undefined): string | null => (t && t.trim() !== '' ? t.trim() : null)

  const { data: testes, error: eT } = await sb.from('ab_tests').select('id').eq('site_id', siteId).eq('youtube_video_id', videoId).in('status', ['active', 'paused'])
  if (eT) throw new Error(`ab_tests: ${eT.message}`)
  const ids = ((testes ?? []) as Array<{ id: string }>).map((t) => t.id)
  if (ids.length > 0) {
    const { data: vars, error: eV } = await sb.from('ab_test_variants').select('title_text').in('test_id', ids).eq('is_original', true)
    if (eV) throw new Error(`ab_test_variants: ${eV.message}`)
    for (const x of (vars ?? []) as Array<{ title_text: string | null }>) { const t = texto(x.title_text); if (t) return t }
  }

  const retrato = texto(await lerRetratoDoEditor(sb, { siteId, videoId, coluna: 'title_at_capture' }))
  if (retrato) return retrato
  return texto(v.title)
}

/**
 * Merge por `(n, atributo)` da `n=1` com o que já está gravado: o título da A é fixado uma vez (nunca regravado pelo cliente) e a
 * imagem da A (cópia do servidor) sobrevive a gravação do cliente que não a traz. Sem título gravado, resolve no servidor.
 */
async function mesclarOriginal(p: Base & { videoId: string; gravada: FichaLinha; rascunho: FichaRascunho }): Promise<FichaRascunho> {
  const { gravada, rascunho } = p
  const guardada = gravada.variantes.find((v) => v.n === 1)
  const recebida = rascunho.variantes.find((v) => v.n === 1)
  if (!guardada && !recebida && rascunho.campos.length === 0 && rascunho.variantes.length === 0) return rascunho // gravação vazia: nada a fixar

  let titulo = guardada?.titulo
  if (!titulo && !recebida?.titulo) titulo = (await resolverTituloOriginal(p.sb, p.siteId, p.videoId)) ?? undefined
  const tipo = rascunho.campos.length === 2 ? 'combo' : rascunho.campos[0] ?? 'titulo'
  const n1: VarianteFicha = { ...(recebida ?? { n: 1, tipo: guardada?.tipo ?? tipo }) }
  if (titulo) n1.titulo = titulo
  const imagem = recebida?.imagem ?? guardada?.imagem
  if (imagem) n1.imagem = imagem
  if (!recebida && !n1.titulo && !n1.imagem) return rascunho
  const variantes = [...rascunho.variantes.filter((v) => v.n !== 1), n1].sort((a, b) => a.n - b.n)
  return { campos: rascunho.campos, variantes }
}

/** Grava campos e variantes sob CAS por `atualizada_em`: quem perde recebe a ficha atual e nada é sobrescrito. */
export async function salvarFichaCore(p: Base & { fichaId: string; lido: string; dados: unknown }): Promise<ResultadoFicha> {
  const v = FichaRascunhoSchema.safeParse(p.dados)
  if (!v.success) return { ok: false, error: v.error.issues.map((i) => `${i.path.join('.') || 'ficha'}: ${i.message}`).join('; ') }
  let rascunho = v.data
  const gravada = await lerFicha(p.sb, p.siteId, p.fichaId)
  if (gravada && gravada.registro_id === null && gravada.descartada_em === null) {
    const mesclado = FichaRascunhoSchema.safeParse(await mesclarOriginal({ sb: p.sb, siteId: p.siteId, videoId: gravada.video_id, gravada, rascunho }))
    if (!mesclado.success) return { ok: false, error: mesclado.error.issues.map((i) => `${i.path.join('.') || 'ficha'}: ${i.message}`).join('; ') }
    rascunho = mesclado.data
  }
  const { data, error } = await p.sb.from('ab_native_fichas')
    .update({ campos: rascunho.campos, variantes: rascunho.variantes })
    .eq('id', p.fichaId).eq('site_id', p.siteId).eq('atualizada_em', p.lido)
    .is('registro_id', null).is('descartada_em', null)
    .select('*')
  if (error) throw new Error(`ab_native_fichas: ${error.message}`)
  const gravadaAgora = (data as FichaLinha[] | null)?.[0]
  if (gravadaAgora) return { ok: true, ficha: derivarFicha(gravadaAgora, hoje(p)) }
  const atual = await lerFicha(p.sb, p.siteId, p.fichaId)
  if (!atual) return { ok: false, error: MSG_NAO_ENCONTRADO }
  return { ok: false, error: MSG_FICHA_MUDOU, fichaAtual: derivarFicha(atual, hoje(p)) }
}

export type ResultadoLeitura = { ok: true; ficha: FichaLida | null; vencida: boolean } | { ok: false; error: string }

/** Só leitura: a ficha aberta mais recente do vídeo e se está vencida (inatividade > 14 d). Nunca cria nem descarta. */
export async function lerFichaDoVideoCore(p: Base & { videoId: string }): Promise<ResultadoLeitura> {
  const { data, error } = await p.sb.from('ab_native_fichas').select('*')
    .eq('site_id', p.siteId).eq('video_id', p.videoId).is('registro_id', null).is('descartada_em', null)
    .order('criada_em', { ascending: false }).limit(1)
  if (error) throw new Error(`ab_native_fichas: ${error.message}`)
  const linha = (data as FichaLinha[] | null)?.[0]
  if (!linha) return { ok: true, ficha: null, vencida: false }
  const ficha = derivarFicha(linha, hoje(p))
  return { ok: true, ficha, vencida: hoje(p).getTime() - ultimaAtividade(ficha) > INATIVIDADE_DESCARTE_MS }
}

/**
 * "Recomeçar", idempotente: lê a velha por id mesmo descartada (sempre com `site_id`), abre/adota a ficha aberta corrente do vídeo
 * (a abertura descarta a inativa e expira o lembrete) e salva nela as versões da velha. Repetir depois de uma falha do salvar
 * completa o trabalho. A nova herda o `studio_aberto_em` da velha: o Studio já foi aberto, então a fonte `i.ytimg.com` segue proibida.
 */
export async function recomecarFichaCore(p: Base & { userId: string; fichaVencidaId: string; salvar?: typeof salvarFichaCore }): Promise<ResultadoFicha> {
  const velha = await lerFicha(p.sb, p.siteId, p.fichaVencidaId)
  if (!velha || velha.registro_id !== null) return { ok: false, error: MSG_NAO_ENCONTRADO }
  const aberta = await abrirFichaCore({ sb: p.sb, siteId: p.siteId, userId: p.userId, videoId: velha.video_id, agora: p.agora })
  if (!aberta.ok || aberta.ficha.id === velha.id) return aberta // ainda não estava vencida: segue a mesma ficha
  let nova = aberta.ficha
  if (velha.studio_aberto_em !== null && nova.studio_aberto_em === null) {
    const { data, error } = await p.sb.from('ab_native_fichas').update({ studio_aberto_em: velha.studio_aberto_em })
      .eq('id', nova.id).eq('site_id', p.siteId).is('registro_id', null).is('descartada_em', null).is('studio_aberto_em', null).select('*')
    if (error) throw new Error(`ab_native_fichas: ${error.message}`)
    const linha = (data as FichaLinha[] | null)?.[0]
    if (linha) nova = derivarFicha(linha, hoje(p))
  }
  if (nova.variantes.length > 0 || nova.campos.length > 0) return { ok: true, ficha: nova } // o salvar de uma tentativa anterior já valeu
  const salvo = await (p.salvar ?? salvarFichaCore)({ sb: p.sb, siteId: p.siteId, agora: p.agora, fichaId: nova.id, lido: nova.atualizada_em, dados: { campos: velha.campos, variantes: velha.variantes } })
  return salvo.ok ? salvo : { ok: false, error: salvo.error, fichaAtual: salvo.fichaAtual ?? nova }
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

export type ResultadoLembrar = { ok: true; lembrarEm: string; jaLembrado: boolean; ficha: FichaLida } | { ok: false; error: string }

/**
 * "Lembrar no computador": notificação do sistema para quem tocou (`dedup_key` por ficha) e `lembrar_em`.
 * A notificação existir sem `lembrar_em` (a gravação caiu) é reparado no 2º toque: a deduplicação responde "suprimida" e `lembrar_em` é gravado.
 */
export async function lembrarNoComputadorCore(p: Base & { userId: string; fichaId: string; criar?: typeof createNotification }): Promise<ResultadoLembrar> {
  const ficha = await lerFicha(p.sb, p.siteId, p.fichaId)
  if (!ficha || ficha.registro_id !== null || ficha.descartada_em !== null) return { ok: false, error: MSG_NAO_ENCONTRADO }
  if (ficha.lembrar_em) return { ok: true, lembrarEm: ficha.lembrar_em, jaLembrado: true, ficha: derivarFicha(ficha, hoje(p)) }

  const { data: video, error: erroVideo } = await p.sb.from('youtube_videos').select('youtube_video_id, title').eq('id', ficha.video_id).eq('site_id', p.siteId).maybeSingle()
  if (erroVideo) throw new Error(`youtube_videos: ${erroVideo.message}`)
  const lido = video as { youtube_video_id: string; title: string | null } | null
  const yt = lido?.youtube_video_id
  if (!yt) return { ok: false, error: MSG_NAO_ENCONTRADO }

  const r = await (p.criar ?? createNotification)({
    site_id: p.siteId, user_id: p.userId, domain: 'youtube', type: 'youtube.native_ficha_lembrar', priority: 3,
    title: 'Abrir a ficha no computador',
    suggested_action: 'Abrir a ficha',
    message: `${lido?.title ?? ''}. Ficha do teste do YouTube salva no celular.`.replace(/^\. /, ''),
    dedup_key: `ficha-lembrar:${ficha.id}`,
    payload: { ficha_id: ficha.id, video_id: ficha.video_id },
    action_href: `/cms/youtube/ab-lab?video=${yt}`,
  })
  if (!r.success) return { ok: false, error: r.error ?? 'não foi possível criar o lembrete' }

  const lembrarEm = hoje(p).toISOString()
  const { data, error } = await p.sb.from('ab_native_fichas').update({ lembrar_em: lembrarEm })
    .eq('id', ficha.id).eq('site_id', p.siteId).is('lembrar_em', null).is('registro_id', null).is('descartada_em', null).select('*')
  if (error) return { ok: false, error: `não foi possível gravar o lembrete: ${error.message}` }
  const gravada = (data as FichaLinha[] | null)?.[0]
  if (gravada?.lembrar_em) return { ok: true, lembrarEm: gravada.lembrar_em, jaLembrado: r.suppressed === true, ficha: derivarFicha(gravada, hoje(p)) }
  // Outro toque gravou na frente: devolve a data que ficou.
  const atual = await lerFicha(p.sb, p.siteId, ficha.id)
  return atual?.lembrar_em ? { ok: true, lembrarEm: atual.lembrar_em, jaLembrado: true, ficha: derivarFicha(atual, hoje(p)) } : { ok: false, error: MSG_NAO_ENCONTRADO }
}
