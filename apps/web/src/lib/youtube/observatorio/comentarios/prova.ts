// A5 · E14: o veredito da prova (`competitor_comment_health`), puro. Dado o que o banco devolveu, diz o que fica vermelho.
// Quem chama: `coletar` (começo e fim da coleta) e `anular` (depois de apagar). Cada chamador vira `status: 'erro'` na tarefa.
//
// Regra de ouro (este sistema falha em VERDE): prova ausente, nula, fora da forma ou com número impossível é VERMELHO
// (`prova_ilegivel`), nunca "tudo zero". Nenhum texto sai daqui: só código de catálogo e número.
import { CODIGOS_EXECUCAO, COMMENT_RULES, MOTIVOS, MOTIVOS_PASSAGEIROS, MOTIVOS_PERDA_ACEITA } from './regras'
import type { CodigoExecucao, ProvaComentarios } from './tipos'

export interface Vermelho { codigo: CodigoExecucao; n: number }
export interface Veredito { vermelhos: Vermelho[]; numeros: Record<string, number> }
export interface ContextoVeredito {
  /** A execução não deixou nada (`ficaram = 0`) e não parou por cota nem pelo disjuntor. Sem isto, atraso é esperado. */
  filaZerada: boolean
  /** `identidade`: só as quatro primeiras linhas da tabela (é o que `anular` usa). */
  so?: 'identidade'
}

export const CHAVES_CONTAGEM = [
  'identidade_vencida', 'identidade_prazo_errado', 'identidade_de_criador', 'respostas_de_terceiros', 'retratos_atrasados',
  'retratos_em_erro', 'retratos_na_janela', 'retratos_perdidos_7d', 'retratos_total', 'retratos_ok', 'comentarios_total',
  'identidades_total', 'comentarios_ausentes_sem_decisao',
] as const
export const CHAVES_MAPA = ['erros_por_motivo', 'perdidos_por_motivo'] as const
export const CHAVES_DATA = ['primeira_coleta', 'ultima_coleta'] as const

const ILEGIVEL: Veredito = { vermelhos: [{ codigo: 'prova_ilegivel', n: 1 }], numeros: {} }

const ehObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const ehContagem = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0

function mapaValido(x: unknown): x is Record<string, number> {
  return ehObj(x) && Object.values(x).every(ehContagem)
}

/** As 17 chaves, com o tipo certo e nenhum número negativo ou fracionário. A prova do banco já passa por isto em `lerProva`; aqui é a defesa de quem recebe. */
function provaValida(p: unknown): p is ProvaComentarios {
  if (!ehObj(p)) return false
  for (const k of CHAVES_CONTAGEM) if (!ehContagem(p[k])) return false
  for (const k of CHAVES_MAPA) if (!mapaValido(p[k])) return false
  for (const k of CHAVES_DATA) if (p[k] !== null && typeof p[k] !== 'string') return false
  return true
}

function msDe(iso: string | null): number | null {
  if (iso === null) return null
  const ms = Date.parse(iso)
  return Number.isFinite(ms) ? ms : null
}

const soma = (m: Record<string, number>): number => Object.values(m).reduce((a, b) => a + b, 0)
const indiceDe = (motivo: string): number => {
  const i = (MOTIVOS as readonly string[]).indexOf(motivo)
  return i < 0 ? MOTIVOS.length : i // fora do catálogo: a frase diz "outro", nunca o texto
}

/**
 * Perdidos que NÃO são aceitos: a soma dos motivos fora de `MOTIVOS_PERDA_ACEITA`, mais o que o total diz e o mapa não explica
 * (mapa incompleto nunca esconde perda).
 */
function perdidosForaDoAceito(p: ProvaComentarios): number {
  const aceitos: readonly string[] = MOTIVOS_PERDA_ACEITA
  let fora = 0
  for (const [motivo, n] of Object.entries(p.perdidos_por_motivo)) if (!aceitos.includes(motivo)) fora += n
  const naoExplicado = Math.max(0, p.retratos_perdidos_7d - soma(p.perdidos_por_motivo))
  return fora + naoExplicado
}

/** O maior grupo preso num motivo que não é passageiro, com `stuckSameReasonRed` ou mais. Empate: o motivo que vem antes em MOTIVOS. */
function erroPreso(p: ProvaComentarios): { n: number; motivo: string } | null {
  const passageiros: readonly string[] = MOTIVOS_PASSAGEIROS
  let melhor: { n: number; motivo: string } | null = null
  for (const [motivo, n] of Object.entries(p.erros_por_motivo)) {
    if (passageiros.includes(motivo) || n < COMMENT_RULES.stuckSameReasonRed) continue
    if (melhor === null || n > melhor.n || (n === melhor.n && indiceDe(motivo) < indiceDe(melhor.motivo))) melhor = { n, motivo }
  }
  return melhor
}

/**
 * Pura. Os vermelhos saem na ordem de `CODIGOS_EXECUCAO` (o primeiro é o `motivo` da tarefa); as três invariantes da identidade
 * viram uma linha só, com a soma. `numeros` leva os números que as frases leem (`fraseDe`) e a informação que não é prova.
 */
export function veredito(p: ProvaComentarios | null, ctx: ContextoVeredito): Veredito {
  if (!provaValida(p)) return { vermelhos: [...ILEGIVEL.vermelhos], numeros: {} }

  const vermelhos: Vermelho[] = []
  const numeros: Record<string, number> = {
    identidade_vencida: p.identidade_vencida,
    identidade_prazo_errado: p.identidade_prazo_errado,
    identidade_de_criador: p.identidade_de_criador,
    respostas_de_terceiros: p.respostas_de_terceiros,
  }

  if (p.identidade_vencida > 0) vermelhos.push({ codigo: 'identidade_vencida', n: p.identidade_vencida })
  const invariantes = p.identidade_prazo_errado + p.identidade_de_criador + p.respostas_de_terceiros
  if (invariantes > 0) vermelhos.push({ codigo: 'identidade_invariante', n: invariantes })

  if (ctx.so !== 'identidade') {
    Object.assign(numeros, {
      retratos_atrasados: p.retratos_atrasados,
      retratos_em_erro: p.retratos_em_erro,
      retratos_perdidos_7d: p.retratos_perdidos_7d,
      retratos_na_janela: p.retratos_na_janela,
      retratos_total: p.retratos_total,
      retratos_ok: p.retratos_ok,
      comentarios_total: p.comentarios_total,
      identidades_total: p.identidades_total,
      comentarios_ausentes_sem_decisao: p.comentarios_ausentes_sem_decisao,
    })
    const primeira = msDe(p.primeira_coleta)
    const ultima = msDe(p.ultima_coleta)
    if (primeira !== null) numeros.primeira_coleta_ms = primeira
    if (ultima !== null) numeros.ultima_coleta_ms = ultima

    if (ctx.filaZerada && p.retratos_atrasados > 0) vermelhos.push({ codigo: 'retratos_atrasados', n: p.retratos_atrasados })

    const perdidos = perdidosForaDoAceito(p)
    numeros.perdidos_fora_do_aceito = perdidos
    if (perdidos > 0) vermelhos.push({ codigo: 'retratos_perdidos', n: perdidos })

    const preso = erroPreso(p)
    numeros.erros_presos_max = preso === null ? 0 : preso.n
    if (preso !== null) {
      numeros.motivo_preso = indiceDe(preso.motivo)
      vermelhos.push({ codigo: 'erros_presos', n: preso.n })
    }
  }

  vermelhos.sort((a, b) => CODIGOS_EXECUCAO.indexOf(a.codigo) - CODIGOS_EXECUCAO.indexOf(b.codigo))
  return { vermelhos, numeros }
}
