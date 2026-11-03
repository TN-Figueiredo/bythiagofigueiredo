// Trava de taxa do Sentry no Node (Phil P5): ao ligar o Node em produção, ~256 chamadas
// `captureMessage` passam a enviar de uma vez, e a cota grátis (5.000 erros/mês, dividida com o edge)
// e a proteção de spike do edge estão em jogo. Teto simples, em memória, por instância da função.
// Nível `error`/`fatal` e exceções nunca são cortados.

export interface OpcoesTrava {
  /** Máximo de eventos iguais (mesma mensagem) por janela. */
  porMensagem: number
  /** Máximo de eventos não-error por janela, somando todas as mensagens. */
  total: number
  janelaMs: number
}

const PADRAO: OpcoesTrava = { porMensagem: 5, total: 30, janelaMs: 10 * 60_000 }
const MAX_CHAVES = 200

interface EventoMinimo {
  message?: string
  level?: string
  exception?: { values?: Array<{ value?: string }> }
}

export function criarTravaDeTaxa(opcoes: Partial<OpcoesTrava> = {}) {
  const cfg = { ...PADRAO, ...opcoes }
  let inicio = 0
  let total = 0
  const porChave = new Map<string, number>()

  return {
    /** true = enviar; false = descartar. */
    permitir(evento: EventoMinimo, agora: number = Date.now()): boolean {
      if (evento.level === 'error' || evento.level === 'fatal') return true
      if (evento.exception?.values?.length) return true
      if (agora - inicio >= cfg.janelaMs) {
        inicio = agora
        total = 0
        porChave.clear()
      }
      const chave = (evento.message ?? 'sem-mensagem').slice(0, 120)
      const n = porChave.get(chave) ?? 0
      if (n >= cfg.porMensagem || total >= cfg.total) return false
      if (!porChave.has(chave) && porChave.size >= MAX_CHAVES) return false
      porChave.set(chave, n + 1)
      total++
      return true
    },
  }
}
