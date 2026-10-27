import type { DisplayLabel, TestType } from '@/lib/youtube/ab-types'

export interface VarianteDaPrevia {
  label: DisplayLabel
  thumbUrl: string | null
  title: string
  isOriginal: boolean
}

export interface CartaoDaPrevia {
  label: DisplayLabel
  thumbUrl: string | null
  title: string
}

const SEM_TITULO = 'Sem título'

function tituloOuAviso(t: string): string {
  return t.trim() === '' ? SEM_TITULO : t
}

/**
 * O que cada variante mostra ao espectador, conforme o que o teste muda:
 * título ⇒ todas com a miniatura da original; thumbnail ⇒ todas com o título da original; combo ⇒ os dois próprios.
 * Sem original na lista, cada uma mostra os seus. Título vazio vira "Sem título".
 */
export function previaPorTipo(tipo: TestType, variantes: ReadonlyArray<VarianteDaPrevia>): CartaoDaPrevia[] {
  const original = variantes.find((v) => v.isOriginal)
  return variantes.map((v) => {
    const thumbUrl = tipo === 'title' && original ? original.thumbUrl : v.thumbUrl
    const title = tipo === 'thumbnail' && original ? original.title : v.title
    return { label: v.label, thumbUrl, title: tituloOuAviso(title) }
  })
}

/** 1ª letra não original sem imagem própria quando o teste troca a thumbnail; senão null. */
export function faltaThumbDe(
  tipo: TestType,
  variantes: ReadonlyArray<Pick<VarianteDaPrevia, 'label' | 'thumbUrl' | 'isOriginal'>>,
): DisplayLabel | null {
  if (tipo !== 'thumbnail' && tipo !== 'combo') return null
  return variantes.find((v) => !v.isOriginal && !v.thumbUrl)?.label ?? null
}

/** Frase `d` do apoio da prévia (texto 11 do plano M6). */
export function descricaoDaPrevia(tipo: TestType, quantas: number): string {
  const todas = quantas >= 3 ? 'três' : 'duas'
  if (tipo === 'title') return `Neste teste só o título muda: a miniatura é a mesma nas ${todas}.`
  if (tipo === 'thumbnail') return `Neste teste só a thumbnail muda: o título é o mesmo nas ${todas}.`
  return 'Neste teste o título e a miniatura mudam juntos.'
}
