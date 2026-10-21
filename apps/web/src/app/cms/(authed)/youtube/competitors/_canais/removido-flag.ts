/**
 * "Apagado" entre a página do canal e a lista de Canais (D13). Cada tela tem o seu `ToastProvider`, então o toast criado antes do `router.push`
 * some com a página. O aviso viaja pelo estado do navegador (sessionStorage), NUNCA pela URL: um link forjado não afirma "apagado" (Yannis N-2).
 * Vale por 2 minutos e é lido uma vez.
 */
const CHAVE = 'obs-canal-removido'
const VALE_MS = 120_000

export interface CanalRemovido { nome: string; videos: number; registros?: number; leituras?: number }

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
    return {
      nome: r.nome.slice(0, 120), videos: r.videos,
      ...(typeof r.registros === 'number' ? { registros: r.registros } : {}),
      ...(typeof r.leituras === 'number' ? { leituras: r.leituras } : {}),
    }
  } catch { return null }
}
