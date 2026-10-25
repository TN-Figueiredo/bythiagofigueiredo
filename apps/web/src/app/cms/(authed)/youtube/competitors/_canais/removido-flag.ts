/**
 * "Apagado" entre a página do canal e a lista de Canais (D13). Cada tela tem o seu `ToastProvider`, então o toast criado antes do `router.push`
 * some com a página. O aviso viaja pelo estado do navegador (sessionStorage), NUNCA pela URL: um link forjado não afirma "apagado" (Yannis N-2).
 * Vale por 2 minutos e é lido uma vez.
 */
import type { Capacidade, ImagensDoAviso } from './remover-model'

const CHAVE = 'obs-canal-removido'
const VALE_MS = 120_000

export interface CanalRemovido { nome: string; videos: number; registros?: number; leituras?: number; imagens?: ImagensDoAviso }

export function marcarRemovido(d: CanalRemovido, agora = Date.now()): void {
  try { sessionStorage.setItem(CHAVE, JSON.stringify({ ...d, em: agora })) } catch { /* sem storage: a lista só não mostra o toast */ }
}

export function lerRemovido(agora = Date.now()): CanalRemovido | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    if (bruto == null) return null
    sessionStorage.removeItem(CHAVE)
    const o: unknown = JSON.parse(bruto)
    if (typeof o !== 'object' || o === null) return null
    const r = o as Record<string, unknown>
    if (typeof r.nome !== 'string' || typeof r.videos !== 'number' || typeof r.em !== 'number') return null
    if (agora - r.em > VALE_MS || agora - r.em < -5_000) return null
    const im = typeof r.imagens === 'object' && r.imagens !== null ? r.imagens as Record<string, unknown> : null
    const n = (x: unknown): number | undefined => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : undefined)
    const cap: Capacidade | undefined = im && (im.capacidade === 'sim' || im.capacidade === 'nao-sim' || im.capacidade === 'nao-nao') ? im.capacidade : undefined
    const imagens: ImagensDoAviso | null = im ? {
      ...(n(im.imagensRestantes) !== undefined ? { imagensRestantes: n(im.imagensRestantes) } : {}),
      ...(n(im.imagensAoAbrir) !== undefined ? { imagensAoAbrir: n(im.imagensAoAbrir) } : {}),
      ...(cap ? { capacidade: cap } : {}),
      ...(typeof im.dataDoComando === 'string' ? { dataDoComando: im.dataDoComando.slice(0, 10) } : {}),
    } : null
    return {
      nome: r.nome.slice(0, 120), videos: r.videos,
      ...(imagens && Object.keys(imagens).length > 0 ? { imagens } : {}),
      ...(typeof r.registros === 'number' ? { registros: r.registros } : {}),
      ...(typeof r.leituras === 'number' ? { leituras: r.leituras } : {}),
    }
  } catch { return null }
}
