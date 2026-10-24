// Texto e casos do placar (S8-F3 T5; cópia do mockup M4 r3.1). Funções puras, testáveis em node.
// Sem comparação entre variantes: nenhuma frase fala de líder, ganho, chance ou %.
import type { Placar, PlacarVariante, DiaDaFaixa } from '@/lib/youtube/ab-gravacao/placar'

export type CasoPlacar = 'nao_iniciado' | 'atrasado' | 'sem_dia_fechado' | 'nao_medido' | 'poucas' | 'normal'
export type FaixaPlacar = 'atrasado' | 'sem_dia_fechado'

const nf = new Intl.NumberFormat('pt-BR')
export const n = (x: number): string => nf.format(x)

/** `2026-10-21` -> `21/10`. */
export function dataCurta(dayPt: string): string {
  const [, m, d] = dayPt.split('-')
  return `${d}/${m}`
}

const dtf = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
})
/** Instante ISO -> `{ data: '20/10', hora: '10:40' }` em horário de Brasília. */
export function dataEHora(iso: string): { data: string; hora: string } {
  const p = Object.fromEntries(dtf.formatToParts(new Date(iso)).map(x => [x.type, x.value]))
  return { data: `${p.day}/${p.month}`, hora: `${p.hour}:${p.minute}` }
}

const ORDEM = ['A', 'B', 'C', 'D']
/** Ordem fixa por rótulo (A, B, C, D); nunca por CTR. Não muta a entrada. */
export function ordenarPorRotulo<T extends { label: string }>(xs: readonly T[]): T[] {
  return [...xs].sort((a, b) => ORDEM.indexOf(a.label) - ORDEM.indexOf(b.label))
}

const semCtr = (v: PlacarVariante) => v.impressoes !== null && v.impressoes > 0 && v.impressoes_com_ctr === 0 && v.cliques === null

export function casoDoPlacar(p: Placar): CasoPlacar {
  if (!p.iniciado) return 'nao_iniciado'
  if (p.atrasado) return 'atrasado'
  if (p.dias_total === 0) return 'sem_dia_fechado'
  const comVolume = p.variantes.filter(v => v.impressoes !== null)
  // Impressões sem CTR em toda variante que tem volume: não há clique a mostrar (nunca 0).
  if (comVolume.some(semCtr) && comVolume.every(v => semCtr(v) || v.impressoes === 0)) return 'nao_medido'
  if (comVolume.length > 0 && comVolume.every(v => (v.impressoes as number) >= 1 && (v.impressoes as number) <= 3)) return 'poucas'
  return 'normal'
}

/** Faixa de estado em 2 níveis, por prioridade: dados fora de hora | sem dia fechado. */
export function faixaDoPlacar(p: Placar): FaixaPlacar | null {
  if (!p.iniciado) return null
  if (p.atrasado) return 'atrasado'
  if (p.dias_total === 0) return 'sem_dia_fechado'
  return null
}

function ultimoDiaGravado(p: Placar, faixa?: readonly DiaDaFaixa[]): string | null {
  if (faixa && faixa.length > 0) return dataCurta(faixa.reduce((m, d) => (d.day_pt > m ? d.day_pt : m), faixa[0]!.day_pt))
  return p.atualizado_em ? dataEHora(p.atualizado_em).data : null
}

export function totalDeImpressoes(p: Placar): number | null {
  const xs = p.variantes.map(v => v.impressoes).filter((x): x is number => x !== null)
  return xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0)
}

export function fraseDoPlacar(
  p: Placar,
  status: string,
  faixa?: readonly DiaDaFaixa[],
  andamento?: { dayOf: number; total: number },
): { principal: string; apoio: string } {
  const caso = casoDoPlacar(p)
  switch (caso) {
    case 'nao_iniciado':
      return { principal: 'O teste ainda não começou.', apoio: 'Até lá não há números.' }
    case 'atrasado': {
      const ult = ultimoDiaGravado(p, faixa)
      if (p.dias_total === 0 || ult === null) {
        return { principal: 'Os dados do YouTube não rodaram desde o início do teste. Ainda não há números.', apoio: 'O teste segue valendo; a próxima leitura traz os dias fechados.' }
      }
      return { principal: `Os dados do YouTube pararam em ${ult}. Os números abaixo estão desatualizados.`, apoio: 'O teste segue valendo; a próxima leitura traz os dias novos.' }
    }
    case 'sem_dia_fechado':
      return { principal: 'O teste começou há pouco. O YouTube ainda não fechou nenhum dia.', apoio: '' }
    case 'nao_medido':
      return { principal: 'Os dias medidos ainda não têm cliques: faltam dados do YouTube.', apoio: 'Sem o CTR do YouTube os cliques não podem ser estimados; eles não são mostrados como 0.' }
    case 'poucas':
      return { principal: `${p.variantes.length} variantes, ${n(totalDeImpressoes(p) ?? 0)} impressões no total.`, apoio: 'Contagens muito pequenas: um clique muda tudo. Não leia isto como resultado.' }
    case 'normal':
      break
  }
  const total = totalDeImpressoes(p)
  const principal = total === null
    ? `${p.variantes.length} variantes, sem impressões medidas ainda.`
    : `${p.variantes.length} variantes, ${n(total)} impressões no total.`
  const aguardando = Math.max(0, ...p.variantes.map(v => v.dias_aguardando))
  let apoio: string
  if (aguardando > 0) {
    apoio = `${aguardando} ${aguardando === 1 ? 'dia ainda aguarda' : 'dias ainda aguardam'} o YouTube`
    apoio += p.proximo_fechamento ? `; ${aguardando === 1 ? 'fecha' : 'fecham'} no máximo até ${dataCurta(p.proximo_fechamento)}.` : '.'
  } else if (p.regra === 'v1' && andamento) {
    apoio = `Este teste termina por duração, no dia ${andamento.total}.`
  } else if ((status === 'active' || status === 'paused') && andamento && andamento.total > andamento.dayOf) {
    const f = andamento.total - andamento.dayOf
    apoio = `Falta${f === 1 ? '' : 'm'} ${f} ${f === 1 ? 'dia' : 'dias'} para o teste terminar.`
  } else if (status === 'active' || status === 'paused') {
    apoio = 'Último dia do teste.'
  } else {
    apoio = 'Teste encerrado; contagens do YouTube dos dias fechados.'
  }
  return { principal, apoio }
}
