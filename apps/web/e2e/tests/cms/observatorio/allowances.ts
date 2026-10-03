// apps/web/e2e/tests/cms/observatorio/allowances.ts — ruled allowances shared by several specs (Task 35b fix round 1).
// Each is one element or one text, with its ruling; a spec applies it only to the states it affects.
import type { Allow, Exclude } from './fidelity'

/**
 * Canais table (every Canais screen, the forja's channel drawer included):
 *  - R60 (FU-5): no daily views / subscriber history of an own channel — every own row's views/day (3rd) and growth cells
 *    (`tr.you` matches each row of the "Seus canais" group);
 *  - R62: the error row's "Atualizar handle…" button and its "Mudou de handle ou foi removido?" message (Task 23);
 *  - R64: the table's sideways-scroll hint follows the CMS shell's real width.
 */
export const CANAIS_TABLE_EXCLUDE: Required<Exclude> = {
  mockup: ['tr.you > td:nth-child(3)', 'tr.you > td.grow', '[data-fixhandle]', 'td.sync:has([data-fixhandle]) .msg', '#scrollHint'],
  impl: ['tr.you > td:nth-child(3)', 'tr.you > td.grow', '[data-scroll-hint]'],
}
/**
 * F11 / Task 23 ruling (brief test, CONVENCOES:267): bald and bankrupt (activity "parado") has views "até o registro
 * diário"; canais.html prints it only for atrasado/erro — only bald's views/day cell suffix.
 */
export const BALD_ROW_SUFFIX_F11: Allow = { drop: /(?<=8,4 mil\/dia, n = 53), até o registro diário de 24\/10 12:00/ }
/**
 * R60 (FU-5), drawer of an OWN channel: no daily views and no subscriber history in production, so the value and the
 * sub-line of "Views/dia" (2nd stat) and of "Crescimento, 30 d" (3rd stat) differ — the labels stay compared.
 */
export const OWN_DRAWER_R60: Required<Exclude> = {
  mockup: ['#dStats > div:nth-child(2) > :not(:first-child)', '#dStats > div:nth-child(3) > :not(:first-child)'],
  impl: ['.dstats > div:nth-child(2) > :not(:first-child)', '.dstats > div:nth-child(3) > :not(:first-child)'],
}
/** R61 (FU-6): competitor_channels has no handle column — the drawer's handle link only. */
export const HANDLE_R61: Exclude = { mockup: ['#dMeta a.handle'] }

/**
 * R67 (C12): the mockup's hand-written scenario sentence vs the engine's general composition of the same requests
 * (dados.js:1556 vs 1563, ported faithfully) — the product wins. Exact sentence pairs, and the state chip next to them.
 */
export const COMPOSE_R67: Allow[] = [
  /Leitura de IA publicada às 14:50\. O pedido de Viagem está em andamento desde 14:55\.|Pedido de Viagem em andamento desde 14:55\. A leitura de IA foi publicada às 14:50\./,
  /O pedido de IA foi recusado\. A máquina recebeu dados de 23\/10 18:00, anteriores à sincronização das 12:00\. O pedido de Viagem segue na fila desde 14:50\. A recusa de IA não conta na cota; você pode pedir de novo a de IA agora\.|Pedido de Viagem na fila desde 14:50\. A máquina consulta a cada 10 min \(próxima às 15:05\)\. O pedido de IA foi recusado às 14:56\./,
  /(?:em andamento|trabalhando)(?= Viagem: trabalhando desde 14:55 · IA: publicado às 14:50)/,
  /(?:em andamento|na fila)(?= Viagem: na fila · pedido 14:50 · IA: recusado às 14:56)/,
]
/** R67 (C11): after IA publishes, the mockups keep the 20/10 reading as "the latest"; production has the new one. */
export const LATEST_READING_R67: Allow[] = [/Última leitura: (?:20\/10 06:10|24\/10 14:50)\./]
