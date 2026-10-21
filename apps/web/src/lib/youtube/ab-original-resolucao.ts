export const LARGURA_ALTA = 1280

/** Baixa = largura ausente, 0, não numérica ou < 1280 (D1). */
export function publicaBaixa(largura: number | null | undefined): boolean {
  return !Number.isFinite(largura) || (largura as number) < LARGURA_ALTA
}

/** `dimensions` é TEXT "LxA"; nulo, 0 ou ilegível devolve null. */
export function dimensoesDeTexto(d: string | null | undefined): { largura: number; altura: number } | null {
  const m = /^(\d+)x(\d+)$/.exec(d ?? '')
  if (!m) return null
  const largura = Number(m[1]); const altura = Number(m[2])
  return largura > 0 && altura > 0 ? { largura, altura } : null
}

export type AvisoOriginal =
  | { kind: 'baixa'; selo: 'Baixa resolução'; texto: string }
  | { kind: 'nao-medida'; selo: 'Resolução não medida'; texto: string }
  | { kind: 'indisponivel'; selo: null; texto: 'Não consegui conferir a resolução da original agora.' }

export const AVISO_INDISPONIVEL: AvisoOriginal = {
  kind: 'indisponivel', selo: null, texto: 'Não consegui conferir a resolução da original agora.',
}

const CAUDA_AVISO = 'o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.'
const SAIDA_AVISO = `Para evitar, troque a thumbnail do vídeo no YouTube por uma de ${LARGURA_ALTA} px ou mais antes de ativar; ou ative assim mesmo.`

/**
 * Aviso do passo Revisar (D12). null = original em alta, nada a dizer. Nunca bloqueia.
 * `medida` = a original já tem dHash guardado (foi guardada e medida). Sem medida não se afirma "baixa":
 * o início do teste regrava a maior cópia e mede.
 */
export function textoAvisoOriginalBaixa(
  dimensions: string | null | undefined,
  medida: boolean,
): Exclude<AvisoOriginal, { kind: 'indisponivel' }> | null {
  const dim = dimensoesDeTexto(dimensions)
  if (dim && !publicaBaixa(dim.largura)) return null
  if (!medida) {
    return {
      kind: 'nao-medida', selo: 'Resolução não medida',
      texto: `A resolução da original ainda não foi medida. Ao ativar, o teste guarda a maior cópia que o YouTube tiver; se ela tiver menos de ${LARGURA_ALTA} px de largura, o vídeo voltaria borrado a cada troca. ${SAIDA_AVISO}`,
    }
  }
  return {
    kind: 'baixa', selo: 'Baixa resolução',
    texto: dim
      ? `A original guardada tem só ${dim.largura}×${dim.altura}: ${CAUDA_AVISO} ${SAIDA_AVISO}`
      : `A original guardada é de baixa resolução (mínimo ${LARGURA_ALTA} px de largura): ${CAUDA_AVISO} ${SAIDA_AVISO}`,
  }
}
