// Módulo leve (sem sharp, sem @vercel/blob, sem 'server-only'): o schema da ficha o importa e pode ir a um client component.
export const PREFIXO_FICHA = 'ab-native-ficha/'

/** Cópia no Blob E dentro do prefixo da ficha. `https` só; qualquer outro host ou caminho (ex.: `ab-test/…`) é recusado. */
export function eUrlDaFicha(u: string): boolean {
  if (!u.startsWith('https://')) return false
  try {
    const url = new URL(u)
    return url.hostname.endsWith('.blob.vercel-storage.com') && url.pathname.startsWith(`/${PREFIXO_FICHA}`)
  } catch {
    return false
  }
}
