import type { FichaLida } from '@/lib/youtube/teste-youtube/nativo/ficha'

export const AGORA_FICHA = new Date('2026-10-22T15:00:00.000Z')
export const URL_IMG = (nome: string): string => `https://abc.public.blob.vercel-storage.com/ab-native-ficha/${nome}.jpg`
export const SHA = 'a'.repeat(64)

export function fichaLida(o: Partial<FichaLida> = {}): FichaLida {
  return {
    id: '11111111-1111-4111-8111-111111111111', site_id: 's', video_id: 'v', campos: ['titulo', 'miniatura'],
    variantes: [{ n: 1, tipo: 'combo', titulo: 'Título da A' }],
    criada_em: '2026-10-22T14:00:00.000Z', criada_por: 'u', atualizada_em: '2026-10-22T14:32:00.000Z',
    studio_aberto_em: null, lembrar_em: null, descartada_em: null, registro_id: null, aberta: true, enviada: false, ...o,
  }
}
/** Emoji conta 1 grafema, mas 2 unidades UTF-16. */
export const TITULO_100 = `${'a'.repeat(99)}🚗`
export const TITULO_101 = `${'a'.repeat(100)}🚗`
