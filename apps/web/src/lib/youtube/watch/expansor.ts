// Expansor da watch (A5 S4, Tarefa 7): LeituraWatch <-> linhas do banco, com o espelho dos CHECKs do Apêndice A.1.
import { z } from 'zod'
import { RENDERERS_TITULO, leituraWatchSchema, type LeituraWatch } from '@/lib/youtube/teste-youtube/tipos'
import { VERSAO_LEITOR } from './parser'
import type { ResultadoLeitor } from './leitor'

export interface LinhaLeitura {
  site_id: string; youtube_video_id: string; lida_em: string; rodada_id: string; origem_rede: 'vercel' | 'forja' | 'mac-casa'
  versao_leitor: number; http: number | null; erro: string | null; idioma: string | null
  titulo_oficial: string | null; titulo_oficial_fonte: 'videoDetails' | 'og_title' | null; titulo_exibido: string | null
  renderers_presentes: number; titulos_divergentes: Array<{ renderer: string; texto: string | null }> | null
  rendicoes_sqp: number | null; jogador_bloqueado: boolean; thumb_k: number | null
}

export interface LinhaThumb {
  k: number; site_id: string; youtube_video_id: string; host: string; variante: string; http: number | null
  etag: string | null; sha16: string | null; dhash: string | null; largura: number | null; altura: number | null; vista_em: string
}

export type LinhaLeituraBanco = Omit<LinhaLeitura, 'thumb_k'> & { miniatura_id: number | null }
export type LinhaThumbBanco = Omit<LinhaThumb, 'k' | 'vista_em'> & { id: number }

const REGEX_ID = /^[A-Za-z0-9_-]{11}$/
const REGEX_HEX16 = /^[0-9a-f]{16}$/

// btrim do Postgres corta só espaços; length conta caracteres (code points)
const naoBranco = (s: string): boolean => s.replace(/^ +| +$/g, '').length > 0
const compr = (s: string): number => [...s].length

const textoBanco = z.string().refine(s => naoBranco(s) && compr(s) <= 500, 'texto fora de 1..500 ou em branco')
const smallint = z.number().int().min(-32768).max(32767)
const http = smallint.min(100).max(599).nullable()   // check (http between 100 and 599)
const instante = z.string().datetime({ offset: true })
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

// yt_watch_titulos_ok(jsonb)
const itemDivergente = z.object({
  renderer: z.string().refine(naoBranco),
  texto: z.string().refine(naoBranco).nullable(),
}).strict()

export const linhaLeituraSchema: z.ZodType<LinhaLeitura> = z
  .object({
    site_id: uuid,
    youtube_video_id: z.string().regex(REGEX_ID),                                     // check youtube_video_id
    lida_em: instante,
    rodada_id: uuid,
    origem_rede: z.enum(['vercel', 'forja', 'mac-casa']),                             // check origem_rede
    versao_leitor: smallint,
    http,
    erro: z.string().regex(/^[a-z0-9_]{1,40}$/).nullable(),                           // check erro
    idioma: z.string().regex(/^[a-z]{2,3}(-([A-Z]{2}|[0-9]{3}))?$/).nullable(),       // check idioma
    titulo_oficial: textoBanco.nullable(),                                            // check titulo_oficial
    titulo_oficial_fonte: z.enum(['videoDetails', 'og_title']).nullable(),            // check titulo_oficial_fonte
    titulo_exibido: textoBanco.nullable(),                                            // check titulo_exibido
    renderers_presentes: smallint.min(0).max(7),                                      // check renderers_presentes
    titulos_divergentes: z.array(itemDivergente).max(10).nullable(),                  // check yt_watch_titulos_ok
    rendicoes_sqp: smallint.min(0).max(200).nullable(),                               // check rendicoes_sqp
    jogador_bloqueado: z.boolean(),
    thumb_k: z.number().int().nullable(),
  })
  .superRefine((l, ctx) => {
    const falha = (message: string): void => { ctx.addIssue({ code: 'custom', message }) }
    if ((l.titulo_oficial === null) !== (l.titulo_oficial_fonte === null)) falha('oficial e fonte nulos juntos')  // check 1 de tabela
    if (l.titulo_exibido !== null && l.titulos_divergentes !== null) falha('exibido e divergentes são excludentes')  // check 2
    if (l.titulo_exibido !== null && l.renderers_presentes <= 0) falha('exibido exige renderers_presentes > 0')   // check 3
    if (l.jogador_bloqueado && l.erro !== null) falha('jogador_bloqueado exige erro nulo')                        // check 4
    if (l.erro !== null && (l.titulo_exibido !== null || l.titulos_divergentes !== null || l.titulo_oficial !== null || l.renderers_presentes !== 0)) {
      falha('leitura com erro não traz dado')                                                                     // check 5
    }
    if (l.erro === null && (l.titulo_exibido !== null || l.titulos_divergentes !== null) && l.idioma === null) falha('idioma obrigatório com título')  // check 6
  })

export const linhaThumbSchema: z.ZodType<LinhaThumb> = z
  .object({
    k: z.number().int(),
    site_id: uuid,
    youtube_video_id: z.string().regex(REGEX_ID),
    host: z.string().regex(/^i[0-9]*\.ytimg\.com$/),                                  // check host
    variante: z.string().regex(/^[a-z0-9]{1,100}$/),                                  // check variante
    http,
    etag: z.string().min(1).refine(s => compr(s) <= 200).nullable(),                  // check etag
    sha16: z.string().regex(REGEX_HEX16).nullable(),                                  // check sha16
    dhash: z.string().regex(REGEX_HEX16).nullable(),                                  // check dhash
    largura: smallint.min(1).max(4096).nullable(),                                    // check largura
    altura: smallint.min(1).max(4096).nullable(),                                     // check altura
    vista_em: instante,
  })
  .superRefine((t, ctx) => {
    if ((t.largura === null) !== (t.altura === null)) ctx.addIssue({ code: 'custom', message: 'largura e altura nulas juntas' })
    if (t.dhash !== null && (t.http !== 200 || t.largura === null)) ctx.addIssue({ code: 'custom', message: 'dhash exige http 200 e dimensões' })
  })

/** `unknown` de propósito: o espelho também julga o que o tipo já recusaria (tabela de casos recusados). */
export function linhaCabeNoBanco(l: unknown): boolean { return linhaLeituraSchema.safeParse(l).success }
export function thumbCabeNoBanco(t: unknown): boolean { return linhaThumbSchema.safeParse(t).success }

type Origem = LinhaLeitura['origem_rede']
const ORIGENS: readonly string[] = ['vercel', 'forja', 'mac-casa']
const ehOrigem = (o: string | null): o is Origem => o !== null && ORIGENS.includes(o)

interface Titulos {
  exibido: string | null
  divergentes: LinhaLeitura['titulos_divergentes']
  mascara: number
}

function titulosDe(l: LeituraWatch): Titulos {
  if (l.erro !== null) return { exibido: null, divergentes: null, mascara: 0 }
  const lista: readonly string[] = RENDERERS_TITULO
  let mascara = 0
  RENDERERS_TITULO.forEach((nome, i) => {
    if (l.titulosExibidos.some(t => t.renderer === nome && t.texto !== null)) mascara |= 1 << i
  })
  const foraDaLista = l.titulosExibidos.some(t => !lista.includes(t.renderer))
  const textos = l.titulosExibidos.filter(t => lista.includes(t.renderer) && t.texto !== null).map(t => t.texto)
  const todosIguais = textos.every(t => t === textos[0])
  if (!foraDaLista && todosIguais) return { exibido: textos[0] ?? null, divergentes: null, mascara }
  return { exibido: null, divergentes: l.titulosExibidos.map(t => ({ renderer: t.renderer, texto: t.texto })), mascara }
}

function canonicaFora(r: ResultadoLeitor, siteId: string): LinhaLeitura {
  const l = r.leitura
  return {
    site_id: siteId, youtube_video_id: l.youtubeVideoId, lida_em: l.lidaEm, rodada_id: l.rodadaId,
    origem_rede: ehOrigem(l.origemRede) ? l.origemRede : 'vercel', versao_leitor: VERSAO_LEITOR,
    http: r.http !== null && r.http >= 100 && r.http <= 599 ? r.http : null,
    erro: 'fora_do_formato', idioma: null, titulo_oficial: null, titulo_oficial_fonte: null, titulo_exibido: null,
    renderers_presentes: 0, titulos_divergentes: null, rendicoes_sqp: null, jogador_bloqueado: false, thumb_k: null,
  }
}

/** Só a 1ª miniatura vira linha (a sonda da rodada); as outras URLs da página nunca foram gravadas. */
export function paraLinhas(r: ResultadoLeitor, siteId: string, k: number): { leitura: LinhaLeitura; thumb: LinhaThumb | null; foraDoFormato: boolean } {
  const l = r.leitura
  const t = titulosDe(l)
  const m = l.miniaturas[0]
  const thumb: LinhaThumb | null = m === undefined ? null : {
    k, site_id: siteId, youtube_video_id: l.youtubeVideoId, host: m.host, variante: m.variante, http: m.http,
    etag: m.etag, sha16: m.sha16, dhash: m.dhash, largura: m.largura, altura: m.altura, vista_em: l.lidaEm,
  }
  const comErro = l.erro !== null
  const leitura: LinhaLeitura | null = ehOrigem(l.origemRede) ? {
    site_id: siteId, youtube_video_id: l.youtubeVideoId, lida_em: l.lidaEm, rodada_id: l.rodadaId, origem_rede: l.origemRede,
    versao_leitor: VERSAO_LEITOR, http: r.http, erro: l.erro, idioma: l.idioma,
    titulo_oficial: comErro ? null : l.tituloOficial, titulo_oficial_fonte: comErro ? null : l.titulo_oficial_fonte,
    titulo_exibido: t.exibido, renderers_presentes: t.mascara, titulos_divergentes: t.divergentes,
    rendicoes_sqp: l.rendicoesSqp, jogador_bloqueado: comErro ? false : r.jogadorBloqueado, thumb_k: thumb === null ? null : k,
  } : null
  if (leitura !== null && linhaCabeNoBanco(leitura) && (thumb === null || thumbCabeNoBanco(thumb))) {
    return { leitura, thumb, foraDoFormato: false }
  }
  return { leitura: canonicaFora(r, siteId), thumb: null, foraDoFormato: true }
}

function titulosDaLinha(b: LinhaLeituraBanco): LeituraWatch['titulosExibidos'] {
  if (b.titulos_divergentes !== null) return b.titulos_divergentes.map(t => ({ renderer: t.renderer, texto: t.texto }))
  return RENDERERS_TITULO.map((renderer, i) => ({
    renderer, texto: b.titulo_exibido !== null && (b.renderers_presentes & (1 << i)) !== 0 ? b.titulo_exibido : null,
  }))
}

/** Devolve só `LeituraWatch` (campos extras ficam no banco); o que o Zod do contrato recusa conta em `invalidas`. */
export function leiturasDoBanco(linhas: readonly LinhaLeituraBanco[], thumbs: readonly LinhaThumbBanco[]): { validas: LeituraWatch[]; invalidas: number } {
  const porId = new Map<number, LinhaThumbBanco>(thumbs.map(t => [t.id, t]))
  const validas: LeituraWatch[] = []
  let invalidas = 0
  for (const b of linhas) {
    const t = b.miniatura_id === null ? undefined : porId.get(b.miniatura_id)
    const candidata = {
      youtubeVideoId: b.youtube_video_id, lidaEm: b.lida_em, rodadaId: b.rodada_id, origemRede: b.origem_rede,
      idioma: b.idioma, erro: b.erro, tituloOficial: b.titulo_oficial, titulo_oficial_fonte: b.titulo_oficial_fonte,
      titulosExibidos: titulosDaLinha(b), rendicoesSqp: b.rendicoes_sqp,
      miniaturas: t === undefined ? [] : [{
        url: `https://${t.host}/vi/${t.youtube_video_id}/${t.variante}.jpg`, host: t.host, variante: t.variante,
        largura: t.largura, altura: t.altura, http: t.http, etag: t.etag, sha16: t.sha16, dhash: t.dhash,
      }],
    }
    const r = leituraWatchSchema.safeParse(candidata)
    if (r.success) validas.push(r.data)
    else invalidas++
  }
  return { validas, invalidas }
}
