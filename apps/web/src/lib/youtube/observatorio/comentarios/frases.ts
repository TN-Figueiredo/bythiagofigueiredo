// A5 · E14: a ÚNICA fonte de texto em português que o dono lê neste passo.
// Sem prefixo de rótulo ("comentários: ") e sem ponto final: quem prefixa é a agenda, com o rótulo da tarefa.
// `FRASES_FIXAS` (frase fixa por código, sem número) e `fraseDe` (frase com números) são exportadas separadas.
import { CODIGOS_EXECUCAO, MOTIVOS } from './regras'
import type { CodigoExecucao } from './tipos'

const DESCONHECIDO = 'falha de código desconhecido (ver Sentry)'

/** Uma frase fixa por código, sem número variável, sem ponto final e sem `$`, `{` ou `%`. É o campo `motivos` do registro da tarefa. */
export const FRASES_FIXAS: Record<CodigoExecucao, string> = {
  schema_ausente: 'migration MG8 não aplicada; nada foi gravado',
  prova_ilegivel: 'não foi possível ler a prova (banco)',
  inicio_nao_decidido: 'a data de início da coleta não foi decidida (COMMENT_SINCE); nada foi coletado',
  identidade_vencida: 'identidade de autores vencida e não apagada; a coleta parou até a anulação rodar',
  identidade_invariante: 'a guarda da identidade está quebrada (prazo diferente de 28 dias, identidade de criador ou respostas de terceiros)',
  lista_de_devidos_ilegivel: 'não foi possível ler a lista do que está devido; nada foi coletado',
  cadastro_ilegivel: 'não foi possível ler os canais acompanhados; nada foi coletado',
  cota_esgotada: 'a cota do YouTube acabou; ficaram retratos para o próximo disparo',
  cota_nao_registrada: 'unidades de cota não registradas',
  inesperado: 'retratos falharam com erro inesperado (ver Sentry)',
  falhas_passageiras: 'leituras falharam; nova tentativa no próximo disparo',
  disjuntor: 'três falhas seguidas; a execução parou e ficaram retratos por fazer',
  consulta_de_autores_falhou: 'a consulta de tamanho dos autores falhou em todas as tentativas da execução',
  conferencia_falhou: 'a conferência dos comentários guardados falhou em todas as tentativas da execução',
  retratos_atrasados: 'vídeos passaram do marco sem retrato e não estavam na lista',
  retratos_perdidos: 'retratos perdidos nos últimos 7 dias (a janela fechou sem retrato)',
  erros_presos: 'retratos presos no mesmo motivo',
  banco: 'o banco não respondeu a tempo ou recusou',
}

/** Alias com o nome do campo do registro da tarefa (Tarefa 12). */
export const motivos = FRASES_FIXAS

type Numeros = Record<string, number>

/** Número presente e finito (zero é válido), ou null. */
function num(n: Numeros, chave: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(n, chave)) return null
  const v: unknown = n[chave]
  return typeof v === 'number' && Number.isFinite(v) ? String(v) : null
}

/** X é índice inteiro em MOTIVOS; fora da faixa ou não inteiro vira "outro". Antes: o número tem de existir. */
function motivoDe(n: Numeros, chave: string): string | null {
  const t = num(n, chave)
  if (t === null) return null
  const i = Number(t)
  return Number.isInteger(i) && i >= 0 && i < MOTIVOS.length ? (MOTIVOS[i] ?? 'outro') : 'outro'
}

/** Uma frase com números: as chaves de `n` que ela lê e como monta. Falta uma chave: a frase é '' (a agenda cai na fixa). */
const COM_NUMEROS: Record<CodigoExecucao, (n: Numeros) => string | null> = {
  schema_ausente: () => 'migration MG8 não aplicada. Nada foi gravado',
  prova_ilegivel: () => FRASES_FIXAS.prova_ilegivel,
  inicio_nao_decidido: () => 'a data de início da coleta não foi decidida (COMMENT_SINCE). Nada foi coletado',
  identidade_vencida: (n) => {
    const N = num(n, 'identidade_vencida')
    return N === null ? null : `identidade de autores vencida e não apagada: ${N}. A coleta parou até a rotina de anulação rodar`
  },
  identidade_invariante: (n) => {
    const N = num(n, 'identidade_prazo_errado')
    const M = num(n, 'identidade_de_criador')
    const K = num(n, 'respostas_de_terceiros')
    return N === null || M === null || K === null
      ? null
      : `a guarda da identidade está quebrada (prazo diferente de 28 dias: ${N}; identidade de criador: ${M}; respostas de terceiros: ${K})`
  },
  lista_de_devidos_ilegivel: () => 'não foi possível ler a lista do que está devido. Nada foi coletado',
  cadastro_ilegivel: () => 'não foi possível ler os canais acompanhados. Nada foi coletado',
  cota_esgotada: (n) => {
    const N = num(n, 'ficaram')
    return N === null ? null : `a cota do YouTube acabou; ${N} retratos ficaram para o próximo disparo`
  },
  cota_nao_registrada: (n) => {
    const N = num(n, 'unidades_nao_registradas')
    return N === null ? null : `${N} unidades de cota não registradas`
  },
  inesperado: (n) => {
    const N = num(n, 'inesperados')
    return N === null ? null : `${N} retratos falharam com erro inesperado (ver Sentry)`
  },
  falhas_passageiras: (n) => {
    const N = num(n, 'falhas_passageiras')
    const X = motivoDe(n, 'motivo_mais_comum')
    return N === null || X === null ? null : `${N} leituras falharam (motivo mais comum: ${X}); nova tentativa no próximo disparo`
  },
  disjuntor: (n) => {
    const X = motivoDe(n, 'motivo_mais_comum')
    const N = num(n, 'ficaram')
    return X === null || N === null ? null : `três falhas seguidas (${X}); a execução parou e ${N} retratos ficaram`
  },
  consulta_de_autores_falhou: (n) => {
    const N = num(n, 'consultas_de_autor_falhas')
    return N === null ? null : `a consulta de tamanho dos autores falhou ${N} vezes seguidas`
  },
  conferencia_falhou: (n) => {
    const N = num(n, 'conferencias_falhas')
    return N === null ? null : `a conferência dos comentários guardados falhou ${N} vezes seguidas`
  },
  retratos_atrasados: (n) => {
    const N = num(n, 'retratos_atrasados')
    return N === null ? null : `${N} vídeos passaram do marco sem retrato e não estavam na lista`
  },
  retratos_perdidos: (n) => {
    const N = num(n, 'perdidos_fora_do_aceito')
    return N === null ? null : `${N} retratos perdidos nos últimos 7 dias (a janela fechou sem retrato)`
  },
  erros_presos: (n) => {
    const N = num(n, 'erros_presos_max')
    const X = motivoDe(n, 'motivo_preso')
    return N === null || X === null ? null : `${N} retratos presos no mesmo motivo (${X})`
  },
  banco: (n) => {
    const N = num(n, 'erros_de_gravacao')
    return N === null ? null : `o banco não respondeu a tempo ou recusou (${N} vezes)`
  },
}

function ehCodigo(c: string): c is CodigoExecucao {
  return (CODIGOS_EXECUCAO as readonly string[]).includes(c)
}

/**
 * A frase com números de um código da execução, pura. `n` é o `numeros` que a tarefa devolve.
 * Código fora de CODIGOS_EXECUCAO: a frase de "desconhecido" (nunca o código cru, que poderia ser texto).
 * Número ausente ou não finito: '' (nunca escreve "undefined" nem "NaN"); a agenda cai na frase fixa.
 */
export function fraseDe(codigo: string, n: Numeros): string {
  if (!ehCodigo(codigo)) return DESCONHECIDO
  return COM_NUMEROS[codigo](n) ?? ''
}
