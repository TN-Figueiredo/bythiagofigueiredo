// Imagem da ficha do teste do YouTube no Blob, com prefixo PRÓPRIO (`ab-native-ficha/`): o cron `ab-draft-cleanup`
// e `deleteVariant` só olham `ab_test_variants` e nunca tocam neste prefixo (travado em test/ab-draft-cleanup-ficha.test.ts).
// `eUrlDaFicha` e `PREFIXO_FICHA` moram em `ficha-url.ts` (leve) e são reexportados daqui.
import { lerRetratoDoEditor } from '@/lib/youtube/observatorio/proprio/ler-retrato-ficha'
import { createHash } from 'node:crypto'
import * as Sentry from '@sentry/nextjs'
import sharp from 'sharp'
import { put } from '@vercel/blob'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import { ehCopiaNoBlob } from '@/lib/youtube/ab-settle'
import { buscarBytesDaOriginal } from '@/lib/youtube/ab-variant-dhash'
import { fetchVariantImageBuffer } from '@/lib/youtube/ab-youtube'
import { eUrlDaFicha, PREFIXO_FICHA } from '@/lib/youtube/teste-youtube/nativo/ficha-url'
import {
  derivarFicha, MSG_NAO_ENCONTRADO, VarianteFichaSchema,
  type FichaLida, type FichaLinha, type OrigemImagem, type VarianteFicha,
} from '@/lib/youtube/teste-youtube/nativo/ficha'

export { eUrlDaFicha, PREFIXO_FICHA }
export const TAMANHO_MAXIMO_IMAGEM = 2 * 1024 * 1024
export const MSG_IMAGEM_GRANDE: string = FRASES.imagem.grande
export const MSG_IMAGEM_FORMATO: string = FRASES.imagem.formato

export interface ImagemGravada {
  url: string; sha256: string; largura: number; altura: number
  origem?: OrigemImagem; capturada_em?: string
}

/** Teto de pixels decodificados (8192 x 8192): um PNG de 2 MB pode descomprimir para ~1 GB (o padrão do sharp é ~268 MP). */
const LIMITE_PIXELS = 8192 * 8192
const ABRIR = { limitInputPixels: LIMITE_PIXELS } as const

interface Formato { ext: 'jpg' | 'png'; contentType: 'image/jpeg' | 'image/png' }
async function lerImagem(bytes: Buffer): Promise<(Formato & { largura: number; altura: number }) | null> {
  try {
    const m = await sharp(bytes, ABRIR).metadata()
    if (!m.width || !m.height || m.width * m.height > LIMITE_PIXELS) return null
    if (m.format === 'jpeg') return { ext: 'jpg', contentType: 'image/jpeg', largura: m.width, altura: m.height }
    if (m.format === 'png') return { ext: 'png', contentType: 'image/png', largura: m.width, altura: m.height }
    return null
  } catch {
    return null
  }
}

/** Re-codifica no mesmo formato, sem metadados (EXIF/GPS/ICC), aplicando a orientação; devolve bytes e medidas do resultado. */
async function tirarMetadados(bytes: Buffer, f: Formato): Promise<{ bytes: Buffer; info: Formato & { largura: number; altura: number } } | null> {
  try {
    const base = sharp(bytes, ABRIR).rotate()
    const limpos = await (f.ext === 'jpg' ? base.jpeg({ quality: 95 }) : base.png()).toBuffer()
    const info = await lerImagem(limpos)
    return info ? { bytes: limpos, info } : null
  } catch {
    return null
  }
}

async function lerFichaAberta(sb: SupabaseClient, siteId: string, fichaId: string): Promise<FichaLinha | null> {
  const { data, error } = await sb.from('ab_native_fichas').select('*')
    .eq('id', fichaId).eq('site_id', siteId).is('registro_id', null).is('descartada_em', null).maybeSingle()
  if (error) throw new Error(`ab_native_fichas: ${error.message}`)
  return (data as FichaLinha | null) ?? null
}

async function gravarNoBlob(
  siteId: string, fichaId: string, bytes: Buffer, f: Formato, enviar: typeof put,
): Promise<{ url: string; sha256: string }> {
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  // Caminho endereçado pelo conteúdo: o 2º envio do mesmo arquivo cai no mesmo caminho; sem `allowOverwrite` o @vercel/blob 2.5.0 lança.
  const blob = await enviar(`${PREFIXO_FICHA}${siteId}/${fichaId}/${sha256}.${f.ext}`, bytes, {
    access: 'public', contentType: f.contentType, addRandomSuffix: false, allowOverwrite: true,
  })
  return { url: blob.url, sha256 }
}

export type ResultadoImagemFicha =
  | { ok: true; ficha: FichaLida; imagem: { url: string; sha256: string; largura: number; altura: number } }
  | { ok: false; error: string }

/**
 * Envio manual da imagem de uma versão. Só guarda o arquivo e devolve a imagem; quem a coloca na ficha é o `salvarFicha`
 * (merge por `(n, atributo)` no cliente). Devolve a ficha lida (com o `atualizada_em` atual) para o hook seguir a partir dela.
 */
export async function guardarImagemDaFichaCore(p: {
  sb: SupabaseClient; siteId: string; fichaId: string; bytes: Buffer; put?: typeof put; agora?: () => Date
}): Promise<ResultadoImagemFicha> {
  if (p.bytes.length > TAMANHO_MAXIMO_IMAGEM) return { ok: false, error: MSG_IMAGEM_GRANDE }
  const linha = await lerFichaAberta(p.sb, p.siteId, p.fichaId)
  if (!linha) return { ok: false, error: MSG_NAO_ENCONTRADO }
  const original = await lerImagem(p.bytes) // o tipo vem do conteúdo, nunca do `file.type` do navegador
  if (!original) return { ok: false, error: MSG_IMAGEM_FORMATO }
  // LGPD (Media System): EXIF/GPS fora. Re-codifica aplicando a orientação, sem `withMetadata`, ANTES do sha256 e das medidas.
  const limpa = await tirarMetadados(p.bytes, original)
  if (!limpa) return { ok: false, error: MSG_IMAGEM_FORMATO }
  const { bytes, info } = limpa
  // O re-encode pode crescer (JPEG q80 -> q95): o limite vale para o arquivo que vai ser gravado e subido no Studio.
  if (bytes.length > TAMANHO_MAXIMO_IMAGEM) return { ok: false, error: MSG_IMAGEM_GRANDE }
  const { url, sha256 } = await gravarNoBlob(p.siteId, p.fichaId, bytes, info, p.put ?? put)
  return { ok: true, ficha: derivarFicha(linha, (p.agora ?? (() => new Date()))()), imagem: { url, sha256, largura: info.largura, altura: info.altura } }
}

// ---------------------------------------------------------------- cópia da miniatura original (D-6)

export const ORCAMENTO_TOTAL_MS = 8_000
export const TEMPO_POR_BUSCA_MS = 4_000
const FUSO = 'America/Sao_Paulo'

export type ResultadoCopiaOriginal =
  | { ok: true; imagem: ImagemGravada & { origem: OrigemImagem; capturada_em: string }; ficha: FichaLida }
  | { ok: false; motivo: 'ja_tem' | 'sem_miniatura' | 'falhou' }

class OrcamentoEstourado extends Error {}

/** `fetch` com teto por busca e teto total: devolve o controle no prazo mesmo se a rede nunca responder. */
function fetchComOrcamento(base: typeof fetch, ate: number): typeof fetch {
  return ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const restante = Math.min(TEMPO_POR_BUSCA_MS, ate - Date.now())
    if (restante <= 0) return Promise.reject(new OrcamentoEstourado('orçamento esgotado'))
    const ctl = new AbortController()
    return new Promise<Response>((resolve, reject) => {
      const t = setTimeout(() => { ctl.abort(); reject(new OrcamentoEstourado('tempo da busca esgotado')) }, restante)
      base(input, { ...init, signal: ctl.signal }).then(
        (r) => { clearTimeout(t); resolve(r) },
        (e) => { clearTimeout(t); reject(e) },
      )
    })
  }) as typeof fetch
}

const diaPt = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

const temImagemNaN1 = (v: VarianteFicha[]): boolean => v.some((x) => x.n === 1 && x.imagem !== undefined)

function falhaCopia(fichaId: string, motivo: 'sem_miniatura' | 'falhou'): { ok: false; motivo: 'sem_miniatura' | 'falhou' } {
  Sentry.captureMessage('cópia da miniatura original para a ficha não feita', { level: 'warning', extra: { fichaId, motivo } })
  return { ok: false, motivo }
}

/**
 * Copia a miniatura original (versão A, `n=1`) para o prefixo da ficha. NÃO é action: só `marcarStudioAberto` (1ª abertura) e
 * `jaIniciei` chamam (T5/T9a), com `permitirYtimg` = `true` só quando o `studio_aberto_em` lido antes era nulo.
 * Fontes em ordem: (a) teste nosso `is_original`, (b) retrato diário anterior ao 1º `studio_aberto_em`, (c) `i.ytimg.com`.
 */
export async function copiarOriginalParaFichaCore(p: {
  sb: SupabaseClient; siteId: string; fichaId: string; permitirYtimg: boolean
  buscar?: typeof fetch; put?: typeof put; agora?: () => Date
}): Promise<ResultadoCopiaOriginal> {
  const agora = p.agora ?? (() => new Date())
  const ate = Date.now() + ORCAMENTO_TOTAL_MS
  const f = fetchComOrcamento(p.buscar ?? fetch, ate)
  try {
    const linha = await lerFichaAberta(p.sb, p.siteId, p.fichaId)
    if (!linha) return falhaCopia(p.fichaId, 'falhou')
    if (temImagemNaN1(linha.variantes)) return { ok: false, motivo: 'ja_tem' }

    const { data: vid, error: eVid } = await p.sb.from('youtube_videos').select('youtube_video_id').eq('id', linha.video_id).eq('site_id', p.siteId).maybeSingle()
    if (eVid) throw new Error(`youtube_videos: ${eVid.message}`)
    const ytId = (vid as { youtube_video_id: string } | null)?.youtube_video_id
    if (!ytId) return falhaCopia(p.fichaId, 'falhou')

    let origem: OrigemImagem | null = null
    let bytes: Buffer | null = null

    // (a) teste nosso ativo/pausado: a variante original
    const { data: testes, error: eT } = await p.sb.from('ab_tests').select('id').eq('site_id', p.siteId).eq('youtube_video_id', linha.video_id).in('status', ['active', 'paused'])
    if (eT) throw new Error(`ab_tests: ${eT.message}`)
    const ids = ((testes ?? []) as Array<{ id: string }>).map((t) => t.id)
    if (ids.length > 0) {
      const { data: vars, error: eV } = await p.sb.from('ab_test_variants').select('blob_url').in('test_id', ids).eq('is_original', true)
      if (eV) throw new Error(`ab_test_variants: ${eV.message}`)
      for (const v of (vars ?? []) as Array<{ blob_url: string | null }>) {
        if (!ehCopiaNoBlob(v.blob_url)) continue
        try {
          bytes = (await fetchVariantImageBuffer(v.blob_url, f)).buffer
          origem = 'teste_nosso'
          break
        } catch (e) { if (e instanceof OrcamentoEstourado) throw e }
      }
    }

    // (b) retrato diário anterior ao dia em que a ficha foi criada, se o Studio já foi aberto (o `studio_aberto_em` é regravado a
    // cada abertura, então não serve de corte: a miniatura viva depois da 1ª abertura pode já ser a B); Studio nunca aberto: anterior a hoje
    if (!bytes) {
      const corte = diaPt(linha.studio_aberto_em ? new Date(linha.criada_em) : agora())
      const url = await lerRetratoDoEditor(p.sb, { siteId: p.siteId, videoId: linha.video_id, coluna: 'thumbnail_blob_url', antesDe: corte })
      if (ehCopiaNoBlob(url)) {
        try {
          bytes = (await fetchVariantImageBuffer(url, f)).buffer
          origem = 'retrato_diario'
        } catch (e) { if (e instanceof OrcamentoEstourado) throw e }
      }
    }

    // (c) YouTube: só na 1ª abertura (a miniatura viva ainda é a A)
    if (!bytes && p.permitirYtimg) {
      bytes = await buscarBytesDaOriginal(ytId, f)
      if (bytes) origem = 'ytimg'
    }
    if (!bytes || !origem) return falhaCopia(p.fichaId, 'sem_miniatura')

    let info = await lerImagem(bytes)
    if (!info) { // por exemplo WebP: converte para JPEG antes de guardar
      try { bytes = await sharp(bytes, ABRIR).jpeg().toBuffer() } catch { return falhaCopia(p.fichaId, 'sem_miniatura') }
      info = await lerImagem(bytes)
      if (!info) return falhaCopia(p.fichaId, 'sem_miniatura')
    }
    const { url, sha256 } = await gravarNoBlob(p.siteId, p.fichaId, bytes, info, p.put ?? put)
    const imagem = { url, sha256, largura: info.largura, altura: info.altura, origem, capturada_em: agora().toISOString() }
    const nova = VarianteFichaSchema.safeParse({ n: 1, tipo: 'miniatura', imagem })
    if (!nova.success) return falhaCopia(p.fichaId, 'falhou')

    // CAS em `atualizada_em`, com uma repetição reavaliando "sem imagem": nunca sobrescreve.
    let atual: FichaLinha = linha
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const variantes = atual.variantes.some((v) => v.n === 1)
        ? atual.variantes.map((v) => (v.n === 1 ? { ...v, imagem: nova.data.imagem } : v))
        : [...atual.variantes, nova.data].sort((a, b) => a.n - b.n)
      const { data, error } = await p.sb.from('ab_native_fichas').update({ variantes })
        .eq('id', p.fichaId).eq('site_id', p.siteId).eq('atualizada_em', atual.atualizada_em)
        .is('registro_id', null).is('descartada_em', null).select('*')
      if (error) throw new Error(`ab_native_fichas: ${error.message}`)
      const gravada = (data as FichaLinha[] | null)?.[0]
      if (gravada) return { ok: true, imagem, ficha: derivarFicha(gravada, agora()) }
      const relida = await lerFichaAberta(p.sb, p.siteId, p.fichaId)
      if (!relida) return falhaCopia(p.fichaId, 'falhou')
      if (temImagemNaN1(relida.variantes)) return { ok: false, motivo: 'ja_tem' }
      atual = relida
    }
    return falhaCopia(p.fichaId, 'falhou')
  } catch (e) {
    void e // o motivo é só 'falhou'; Sentry leva fichaId e motivo, nunca URL nem título
    return falhaCopia(p.fichaId, 'falhou')
  }
}
