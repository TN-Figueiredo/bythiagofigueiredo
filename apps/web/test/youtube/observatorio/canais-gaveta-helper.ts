// A gaveta lateral de Canais não é mais alcançável por clique (A4, I1 da revisão da T8: concorrente e canal próprio com vídeos abrem a PÁGINA do canal,
// e o próprio sem vídeos não abre nada). O código dela fica até a Tarefa 16 (D16), e a máquina de "feedback imediato" (esqueleto, aba, troca, reabrir)
// continua sob teste com uma linha SINTÉTICA: o canal próprio sem `href` e sem motivo, que é o que o botão "Abrir detalhes de <nome>" da gaveta pede.
import type { CanaisView, CanaisRow } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'

export function comGavetaNoProprio(v: CanaisView): CanaisView {
  const solta = (r: CanaisRow): CanaisRow => (r.own ? { ...r, href: null, semPagina: null } : r)
  return { ...v, list: { ...v.list, ranked: v.list.ranked.map(solta), unranked: v.list.unranked.map(solta) } }
}
