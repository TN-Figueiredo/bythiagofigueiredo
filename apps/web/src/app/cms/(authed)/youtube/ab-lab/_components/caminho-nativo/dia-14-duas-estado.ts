// Estado puro da pergunta do dia 14 (F1a-tela-1, T10b / D-1): só uma ficha de exatamente 2 versões ganha o botão.
// 3 versões ou `variantes` nulo (origem derivada) ficam sem botão, com a frase honesta de `FRASES.resposta.semBotao`.
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'

export type PerguntaDoDia14 = 'duas' | 'sem_botao'

export function perguntaDoDia14(registro: Pick<NonNullable<LinhaDoCaminho['registro']>, 'variantes'>): PerguntaDoDia14 {
  return registro.variantes?.length === 2 ? 'duas' : 'sem_botao'
}
