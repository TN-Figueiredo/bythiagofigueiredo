import { rodarRegistro } from '@/lib/youtube/teste-youtube/registro/tarefa'
import { DEFINICAO_REGISTRO_TESTE_NATIVO } from '../definicoes'
import type { Tarefa } from '../tipos'

/** `registro_teste_nativo`: o que é devido sai da lista de candidatos a cada disparo (`devidaPeloDado` sempre verdadeira, como a `leitura_watch`). */
export const registroTesteNativo: Tarefa = {
  ...DEFINICAO_REGISTRO_TESTE_NATIVO,
  devidaPeloDado: () => true,
  rodar: c => rodarRegistro(c),
}
