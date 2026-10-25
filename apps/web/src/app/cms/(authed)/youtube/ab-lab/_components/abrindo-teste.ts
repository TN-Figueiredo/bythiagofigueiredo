/**
 * D-M6-13: o cabeçalho do teste que está abrindo (título e miniatura), guardado na aba para a tela de carregamento
 * não começar vazia. Só o que a lista ou o assistente já têm; qualquer falha do armazenamento vale como "não sei" (null).
 */
const CHAVE = 'ab-lab:abrindo'

export interface TesteAbrindo { id: string; titulo: string; miniaturaUrl: string | null }

export function guardarTesteAbrindo(c: TesteAbrindo): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify({ id: c.id, titulo: c.titulo, miniaturaUrl: c.miniaturaUrl }))
  } catch { /* sessionStorage indisponível: a tela cai no esqueleto frio */ }
}

export function lerTesteAbrindo(id: string): { titulo: string; miniaturaUrl: string | null } | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    if (!bruto) return null
    const v: unknown = JSON.parse(bruto)
    if (typeof v !== 'object' || v === null) return null
    const o = v as Record<string, unknown>
    if (o.id !== id || typeof o.titulo !== 'string' || o.titulo.trim() === '') return null
    if (o.miniaturaUrl !== null && typeof o.miniaturaUrl !== 'string') return null
    return { titulo: o.titulo, miniaturaUrl: o.miniaturaUrl }
  } catch {
    return null
  }
}
