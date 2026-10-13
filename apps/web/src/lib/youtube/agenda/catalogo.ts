import type { Tarefa } from './tipos'
import { DEFINICOES, type Definicao } from './definicoes'
import { leituraHoraria } from './tarefas/leitura-horaria'
import { sincronizarCanais } from './tarefas/sincronizar-canais'
import { serieSemanal } from './tarefas/serie-semanal'
import { anularIdentidade } from './tarefas/anular-identidade'
import { retratosComentarios } from './tarefas/retratos-comentarios'

// As definições, o interruptor e a lista única moram em `definicoes.ts` (módulo leve, que o vigia importa sem a coleta); daqui saem as mesmas.
export {
  DEFINICOES, DEFINICOES_COMENTARIOS, TODAS_AS_DEFINICOES, DEFINICAO_ANULAR_IDENTIDADE, DEFINICAO_RETRATOS_COMENTARIOS,
  agendaLigada, notaDoInterruptorDaAgenda, tarefasDesligadas,
} from './definicoes'
export type { Definicao } from './definicoes'

/** A definição de `nome` (que tem de existir: o teste do catálogo confere), sem o código. */
function definicao(nome: string): Definicao {
  const d = DEFINICOES.find(x => x.nome === nome)
  if (!d) throw new Error('definição ausente: ' + nome)
  return d
}

/**
 * O catálogo com o código (`rodar`), na ordem de `DEFINICOES`. Quem registra uma tarefa nova escreve `agenda/tarefas/<nome>.ts`
 * exportando uma `Tarefa` inteira (ou, como as três daqui, só o código, montado com a definição) e acrescenta UMA importação e UMA
 * entrada abaixo. Os arquivos das tarefas não importam este arquivo (ciclo).
 */
export const CATALOGO: readonly Tarefa[] = [
  { ...definicao('leitura_horaria'), ...leituraHoraria },
  anularIdentidade,
  { ...definicao('sincronizar_canais'), ...sincronizarCanais },
  retratosComentarios,
  { ...definicao('serie_semanal'), ...serieSemanal },
]
