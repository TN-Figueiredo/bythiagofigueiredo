// A5 · E14: o erro da coleta de comentários e a tradução de qualquer exceção em CÓDIGO.
// Nenhum texto de exceção sai daqui (pode carregar nome, id ou texto de terceiros): só código de catálogo.
import type { Motivo } from './tipos'

export type CodigoComentariosErro = Motivo | 'cota_esgotada' | 'limite_de_taxa' | 'comentarios_desligados'

export class ComentariosErro extends Error {
  readonly codigo: CodigoComentariosErro
  readonly http: number | null

  constructor(codigo: CodigoComentariosErro, http: number | null = null) {
    super('comentarios: ' + codigo)
    this.name = 'ComentariosErro'
    this.codigo = codigo
    this.http = http
  }
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function nomeDe(v: Record<string, unknown>): string | null {
  return typeof v.name === 'string' ? v.name : null
}

/**
 * Traduz o que foi lançado ou devolvido em um código curto, sem texto de fora.
 * Ordem: ComentariosErro; tempo esgotado (ANTES de `code`); erro do banco por SQLSTATE; erro do banco sem código; inesperado:<nome>.
 * Perde-se o rastro de pilha: é o preço.
 */
export function codigoDe(err: unknown): string {
  if (err instanceof ComentariosErro) return err.codigo
  if (!ehObjeto(err)) return 'inesperado:desconhecido'

  // O cliente do Supabase abortado NÃO lança: devolve { message: 'AbortError: …', code: '' }, sem `name`.
  // O DOMException tem `code` numérico (20 ou 23) e cairia em sem_codigo. Só o prefixo é lido.
  const nome = nomeDe(err)
  if (nome === 'AbortError' || nome === 'TimeoutError') return 'banco:tempo_esgotado'
  const mensagem = err.message
  if (typeof mensagem === 'string' && (mensagem.startsWith('AbortError:') || mensagem.startsWith('TimeoutError:'))) {
    return 'banco:tempo_esgotado'
  }

  // Erro do banco: objeto simples (o PostgREST não devolve `Error`). `Error` com `code` (EPIPE, EBUSY) é inesperado.
  if (!(err instanceof Error) && typeof mensagem === 'string') {
    const code = err.code
    if (typeof code === 'string') {
      if (/^PGRST\d{3}$/.test(code)) return 'banco:' + code.toLowerCase()
      if (/^[A-Za-z0-9]{5}$/.test(code)) return 'banco:' + code.toLowerCase()
    }
    if ('code' in err || 'details' in err || 'hint' in err) return 'banco:sem_codigo'
  }

  const filtrado = nome !== null && /^[A-Za-z]{1,30}$/.test(nome) ? nome.toLowerCase() : 'desconhecido'
  return 'inesperado:' + filtrado
}
