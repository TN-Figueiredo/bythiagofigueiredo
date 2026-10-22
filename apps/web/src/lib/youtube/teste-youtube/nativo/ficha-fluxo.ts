// "Abrir no Studio" e "Já iniciei" com a cópia da miniatura original (versão A) no mesmo fluxo (D-6, T5).
// Fica fora de `ficha.ts` para não fechar o ciclo ficha.ts <-> imagem-ficha.ts (que arrasta sharp e @vercel/blob).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { put } from '@vercel/blob'
import { marcarStudioAbertoCore, type FichaLinha, type ResultadoFicha } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { copiarOriginalParaFichaCore } from '@/lib/youtube/teste-youtube/nativo/imagem-ficha'
import { confirmarTesteNoStudio, type ResultadoConfirmar } from '@/lib/youtube/teste-youtube/nativo/confirmar'

interface Base { sb: SupabaseClient; siteId: string; agora?: () => Date; buscar?: typeof fetch; put?: typeof put }

async function lerAberta(sb: SupabaseClient, siteId: string, fichaId: string): Promise<FichaLinha | null> {
  const { data, error } = await sb.from('ab_native_fichas').select('*')
    .eq('id', fichaId).eq('site_id', siteId).is('registro_id', null).is('descartada_em', null).maybeSingle()
  if (error) throw new Error(`ab_native_fichas: ${error.message}`)
  return (data as FichaLinha | null) ?? null
}

/**
 * Marca o Studio como aberto e, só na PRIMEIRA abertura (o `studio_aberto_em` lido ANTES do update era nulo), copia a A
 * (`permitirYtimg: true`). A falha da cópia não aparece: devolve a ficha do update. Devolve sempre a `FichaLida` nova.
 */
export async function marcarStudioAbertoComCopiaCore(p: Base & { fichaId: string }): Promise<ResultadoFicha> {
  const antes = await lerAberta(p.sb, p.siteId, p.fichaId)
  const marcada = await marcarStudioAbertoCore({ sb: p.sb, siteId: p.siteId, fichaId: p.fichaId, agora: p.agora })
  if (!marcada.ok || !antes || antes.studio_aberto_em !== null) return marcada
  const copia = await copiarOriginalParaFichaCore({ sb: p.sb, siteId: p.siteId, fichaId: p.fichaId, permitirYtimg: true, buscar: p.buscar, put: p.put, agora: p.agora })
  return copia.ok ? { ok: true, ficha: copia.ficha } : marcada
}

/**
 * "Já iniciei": antes de vincular (a ficha vinculada deixa de ser "aberta" e a cópia não a acharia), copia a A se a `n=1` ainda
 * está sem `imagem`; `permitirYtimg` só se o Studio ainda não foi aberto por nós. Falha da cópia não impede a confirmação.
 */
export async function jaIniciouCore(p: Base & { userId: string; fichaId: string; confirmar?: typeof confirmarTesteNoStudio }): Promise<ResultadoConfirmar> {
  const antes = await lerAberta(p.sb, p.siteId, p.fichaId)
  if (antes && !antes.variantes.some((v) => v.n === 1 && v.imagem !== undefined)) {
    await copiarOriginalParaFichaCore({ sb: p.sb, siteId: p.siteId, fichaId: p.fichaId, permitirYtimg: antes.studio_aberto_em === null, buscar: p.buscar, put: p.put, agora: p.agora })
  }
  return (p.confirmar ?? confirmarTesteNoStudio)({ sb: p.sb, siteId: p.siteId, userId: p.userId, origem: { fichaId: p.fichaId } })
}
