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
  reserva = null
}

/** O vídeo para onde um href do pager leva (`/…/video/<id>?…`). */
export function videoDoHref(href: string): string {
  try { return decodeURIComponent(new URL(href, 'http://x').pathname.split('/').pop() ?? '') } catch { return '' }
}

// ───── A5 E5a T21c: a chegada decidida pela RESERVA do Suspense (correção 4 da Tarefa 21) ─────
// A reserva (`<HistoricoScreen carregando />`) e o conteúdo são duas montagens do mesmo componente cliente e o efeito de chegada é de uso único:
// a reserva decide o foco e deixa aqui qual controle o tinha; a montagem seguinte do MESMO vídeo devolve o foco a quem estava com ele, sem
// decidir de novo. A marca vale enquanto a reserva está montada e por `VALE_DA_TROCA_MS` depois de ela desmontar (sem relógio de carga).
export const VALE_DA_TROCA_MS = 1_000
let reserva: { videoId: string; foco: string | null; montada: boolean; saiuEm: number | null } | null = null

/** A reserva chegou (ou o foco dela mudou): `foco` é a chave do controle com o foco (`titulo`, `pager-prev`, `pager-next` ou um `data-foco`). */
export function marcarChegadaNaReserva(videoId: string, foco: string | null): void {
  reserva = { videoId, foco, montada: true, saiuEm: null }
}

/** A reserva desmontou: a marca passa a valer só por `VALE_DA_TROCA_MS`. */
export function soltarChegadaDaReserva(videoId: string): void {
  if (reserva && reserva.videoId === videoId) reserva = { ...reserva, montada: false, saiuEm: Date.now() }
}

/** Lê e apaga. Só vale para o mesmo vídeo e dentro da validade; senão `null` (a instância se comporta como sempre). */
export function tomarChegadaNaReserva(videoId: string): { foco: string | null } | null {
  const r = reserva
  reserva = null
  if (!r || r.videoId !== videoId) return null
  if (!r.montada && (r.saiuEm === null || Date.now() - r.saiuEm > VALE_DA_TROCA_MS)) return null
  return { foco: r.foco }
}
