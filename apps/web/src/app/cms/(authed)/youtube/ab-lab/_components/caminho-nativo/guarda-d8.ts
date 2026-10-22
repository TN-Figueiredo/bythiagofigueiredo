// Guarda D-8 (puro): antes de abrir o assistente do NOSSO teste, pergunta se o dono já iniciou o teste do YouTube
// quando há ficha enviada ao Studio nos últimos 14 dias e ainda sem registro (a leitura da lista só traz fichas sem `registro_id`).
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'

const DIA_MS = 86_400_000
/** Igual a `JANELA_FICHA_ENVIADA_DIAS` (ficha.ts); copiada porque aquele módulo é de servidor e este roda no cliente. */
const JANELA_DIAS = 14

export function cobrarD8(l: Pick<LinhaDoCaminho, 'fichaId' | 'fichaEnviadaEm'>, agora: Date): boolean {
  if (l.fichaId === null || !l.fichaEnviadaEm) return false
  const t = Date.parse(l.fichaEnviadaEm)
  if (!Number.isFinite(t)) return false
  return agora.getTime() - t <= JANELA_DIAS * DIA_MS
}
