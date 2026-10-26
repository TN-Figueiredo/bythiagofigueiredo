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
  | { kind: 'indisponivel'; selo: null; texto: 'Não consegui conferir a resolução da original agora. Isso não impede de ativar.' }

export const AVISO_INDISPONIVEL: AvisoOriginal = {
  kind: 'indisponivel', selo: null, texto: 'Não consegui conferir a resolução da original agora. Isso não impede de ativar.',
}

const CAUDA_AVISO = 'o vídeo voltaria borrado a cada troca e ficaria assim depois do teste.'
const SAIDA_AVISO = `Para evitar, troque no YouTube a thumbnail do vídeo por uma de ${LARGURA_ALTA} px ou mais e depois ative: o teste guarda a nova ao ativar, mesmo que este aviso continue aqui. Sem uma maior, pode ativar assim mesmo.`
const TEXTO_NAO_MEDIDA = `Resolução não medida. O teste mede ao ativar; se a miniatura no YouTube tiver menos de ${LARGURA_ALTA} px, troque-a antes de ativar.`

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
      texto: TEXTO_NAO_MEDIDA,
    }
  }
  return {
    kind: 'baixa', selo: 'Baixa resolução',
    texto: dim
      ? `A original guardada tem só ${dim.largura}×${dim.altura}: ${CAUDA_AVISO} ${SAIDA_AVISO}`
      : `A original guardada está abaixo do mínimo de ${LARGURA_ALTA} px de largura: ${CAUDA_AVISO} ${SAIDA_AVISO}`,
  }
}

export type EstadoAviso = 'pendente' | null | AvisoOriginal   // pendente = leitura em andamento; null = alta ou tipo só título

/** Forma do aviso de volume que importa ao banner (o tipo completo mora no hook, que importa este módulo). */
type VolumeDoBanner = 'pendente' | 'indisponivel' | null | { estado: string; texto: string }

/**
 * Título do banner do Revisar (D-M6-8), nesta ordem: falta thumbnail ⇒ pede a imagem; algum aviso visível ⇒ "com um aviso abaixo";
 * alguma leitura pendente ou indisponível ⇒ "Pronto para ativar."; senão "Tudo pronto." (nunca sem ter lido).
 */
export function tituloDoBanner(
  aviso: EstadoAviso | undefined,
  extra?: { volume?: VolumeDoBanner; faltaThumb?: string | null },
): string {
  if (extra?.faltaThumb) return `Falta a thumbnail da variante ${extra.faltaThumb}.`
  const volume = extra?.volume
  const avisoOriginalVisivel = aviso !== undefined && aviso !== null && aviso !== 'pendente' && aviso.kind !== 'indisponivel'
  const avisoVolumeVisivel = typeof volume === 'object' && volume !== null
  if (avisoOriginalVisivel || avisoVolumeVisivel) return 'Pronto para ativar, com um aviso abaixo.'
  const originalSemLer = aviso === 'pendente' || (aviso !== undefined && aviso !== null && aviso.kind === 'indisponivel')
  if (originalSemLer || volume === 'pendente' || volume === 'indisponivel') return 'Pronto para ativar.'
  return 'Tudo pronto.'
}

export const NOTA_ATIVAR = 'Clique em Ativar teste para começar. As variantes começam a alternar depois que o teste for ativado no YouTube.'
