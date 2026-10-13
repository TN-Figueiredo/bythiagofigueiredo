// A5 · E14: o ÚNICO caminho dos comentários para o Sentry. Só um código de catálogo e números; nenhum texto, nome nem id de terceiros.
// O detalhe técnico de uma falha só chega ao Sentry nesta forma, já redigida.
import * as Sentry from '@sentry/nextjs'

const CODIGO_RE = /^[a-z0-9_:]+$/
const CODIGO_MAX = 60

/** Código cortado em 60 e filtrado; o que não casar vira 'codigo_invalido' (nunca o texto recebido). */
function codigoLimpo(codigo: string): string {
  const cortado = typeof codigo === 'string' ? codigo.slice(0, CODIGO_MAX) : ''
  return CODIGO_RE.test(cortado) ? cortado : 'codigo_invalido'
}

export function relatarComentarios(passo: 'coletar' | 'anular', codigo: string, numeros: Record<string, number>): void {
  const limpo = codigoLimpo(codigo)
  const etapa = passo === 'anular' ? 'anular' : 'coletar'
  const extra: Record<string, number> = {}
  for (const [chave, valor] of Object.entries(numeros)) {
    if (typeof valor === 'number' && Number.isFinite(valor)) extra[chave] = valor
  }
  Sentry.captureMessage('comentarios: ' + etapa + ': ' + limpo, {
    level: 'error',
    tags: { component: 'sync-youtube', mode: 'comentarios', codigo: limpo },
    extra,
  })
}
