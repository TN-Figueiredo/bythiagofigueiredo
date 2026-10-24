import type { Placar } from '@/lib/youtube/ab-gravacao/placar'

/** Placar completo e vazio para fixtures de tela (S8-F3 T5). */
export function placarVazio(o: Partial<Placar> = {}): Placar {
  return {
    regra: 'v2', estatistica: 'nao_calculada', variantes: [], dias_total: 0, dias_descartados: 0,
    dias_variante_desconhecida: 0, atualizado_em: null, desatualizado: false, atrasado: false,
    todos_finais: false, iniciado: true, proximo_fechamento: null, ...o,
  }
}
