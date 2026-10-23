// Harnesses antigos (A/B Lab) têm bancos falsos sem `ab_native_tests`: a guarda do teste do YouTube (F1a-dado) enxerga "nenhuma linha aberta".
// A guarda de verdade é coberta por ab-guarda-nativa.test.ts, ab-settle-teste-youtube.test.ts e pelas integrações ab-f1a-*.
import type * as Guarda from '@/lib/youtube/teste-youtube/nativo/guarda'

export function guardaVazia(orig: typeof Guarda): typeof Guarda {
  const vazio = async () => ({ ok: true as const, linhas: new Map<string, Guarda.LinhaAberta>() })
  return { ...orig, bloqueadoPorTesteNativo: vazio, bloqueadoComRetentativa: vazio, lerLinhaConfirmada: async () => null }
}
