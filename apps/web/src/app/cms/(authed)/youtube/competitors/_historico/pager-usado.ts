/**
 * Qual botão do pager (ou qual tecla) a pessoa usou, e para qual vídeo ele levava. Vive FORA do componente de propósito: Anterior e
 * Próximo mudam o segmento `video/[id]`, e o Next pode remontar a tela quando isso acontece; um `useRef` nasceria vazio na tela nova e o
 * foco cairia no título, sem o status "Vídeo 8 de 51". O registro vale poucos segundos (o tempo de a rota chegar, com a rede lenta do
 * desenvolvimento) e só para o vídeo que o botão prometia; quem chega depois é consumido pelo efeito de foco da tela.
 */
export type LadoDoPager = 'prev' | 'next'

const VALE_MS = 10_000
let usado: { which: LadoDoPager; to: string; at: number } | null = null

export function marcarPagerUsado(which: LadoDoPager, to: string): void {
  usado = { which, to, at: Date.now() }
}

/** Lê e apaga. `null` quando não há registro ou ele já expirou. */
export function tomarPagerUsado(): { which: LadoDoPager; to: string } | null {
  const u = usado
  usado = null
  return u && Date.now() - u.at <= VALE_MS ? { which: u.which, to: u.to } : null
}

/** Para os testes. */
export function limparPagerUsado(): void {
  usado = null
}

/** O vídeo para onde um href do pager leva (`/…/video/<id>?…`). */
export function videoDoHref(href: string): string {
  try { return decodeURIComponent(new URL(href, 'http://x').pathname.split('/').pop() ?? '') } catch { return '' }
}
