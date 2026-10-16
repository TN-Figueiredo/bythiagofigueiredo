// A5 · E5b · Tarefa 20c: quais versões do vídeo contam como "troca" para a tela, e o dia delas. Puro: sem banco, sem React.
// Nenhuma palavra daqui afirma causa.
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import type { DiaYt, VersaoPropria, VersoesDoVideo } from '@/lib/youtube/observatorio/proprio-versoes/tipos'

/**
 * A regra do passo 1 de 4.8: título ou thumbnail; origem diferente de linha de base; não pré-registro; não retoque; evento do Lab diferente de rotação.
 * Origem `cms` ENTRA (a tela a trata como não sabida e conta). Em ordem de data, título antes de thumbnail no mesmo dia.
 */
export function trocasQueContam(v: VersoesDoVideo): VersaoPropria[] {
  const lista = v.versoes.filter(x =>
    (x.campo === 'title' || x.campo === 'thumb') && x.origem !== 'linha_de_base' && !x.preRegistro && x.thumb?.retoque !== true && x.eventoAb !== 'rotacao')
  const dia = (x: VersaoPropria): DiaYt => dayPt(new Date(x.janela ? x.janela.ate : x.vistaDesde))
  return lista.sort((a, b) => {
    const da = dia(a), db = dia(b)
    if (da !== db) return da < db ? -1 : 1
    if (a.campo !== b.campo) return a.campo === 'title' ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/** O dia em que o sistema viu a versão nova: `dayPt(janela.ate)`, o dia do Pacífico (nunca o UTC). Janela nula: LANÇA. */
export function diaDaTroca(v: VersaoPropria): DiaYt {
  if (v.janela === null) throw new RangeError('troca sem janela')
  return dayPt(new Date(v.janela.ate))
}

/** O primeiro dia que a leitura do alcance pede para ESTA troca: `dayPt(janela.de) − (janelaDias + 2)`. Janela nula: LANÇA. */
export function desdeDaTroca(v: VersaoPropria, janelaDias: number): DiaYt {
  if (v.janela === null) throw new RangeError('troca sem janela')
  return addDays(dayPt(new Date(v.janela.de)), -(janelaDias + 2))
}
