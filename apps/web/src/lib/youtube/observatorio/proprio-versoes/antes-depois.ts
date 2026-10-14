// O antes e o depois de uma troca (E18, plano seção 4.6). Puro: sem banco, sem `server-only`.
// Mede só o que o relatório de alcance já tem e nunca grava nada. O texto da tela é da parte 6; aqui só estados e números.
// Nenhum nome de campo ou estado afirma causa: a leitura diz o que as faixas mostram, não o que explica a mudança.

import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import type { DiaAlcance } from '../proprio/dias'
import { wilson } from '../proprio/taxa'
import { PROPRIO_RULES, type RegrasTroca } from './regras'
import type { DiaYt, VersaoPropria } from './tipos'

export interface Lado {
  diasCandidatos: number
  diasMedidos: number
  diasSemClique: number
  imp: number
  cliquesEst: number
  taxa: number | null
  lo: number | null
  hi: number | null
}

export type LeituraDaTroca =
  | { estado: 'nao_se_aplica' | 'em_teste_ab' | 'antes_fora_da_janela_lida' }
  | { estado: 'sem_antes' | 'depois_nao_medido' | 'ainda_nao_da'; antes: Lado; depois: Lado; cortada: boolean }
  | { estado: 'com_leitura'; antes: Lado; depois: Lado; cortada: boolean; leitura: 'subiu' | 'caiu' | 'sem_diferenca_firme' }

const ehRetoque = (v: VersaoPropria): boolean => v.thumb?.retoque === true

function diasDe(de: DiaYt, ate: DiaYt): DiaYt[] {
  const out: DiaYt[] = []
  for (let d = de; d <= ate; d = addDays(d, 1)) out.push(d)
  return out
}

function medir(candidatos: readonly DiaYt[], porDia: ReadonlyMap<DiaYt, DiaAlcance>): Lado {
  const l: Lado = { diasCandidatos: candidatos.length, diasMedidos: 0, diasSemClique: 0, imp: 0, cliquesEst: 0, taxa: null, lo: null, hi: null }
  for (const d of candidatos) {
    const x = porDia.get(d)
    if (!x || (x.situacao !== 'com-impressoes' && x.situacao !== 'zero-medido')) continue // não medido e ausente: fora de tudo
    l.diasMedidos++
    if (x.imp === null || x.cliques === null) { l.diasSemClique++; continue }
    l.imp += x.imp
    l.cliquesEst += x.cliques
  }
  return l
}

export function anteDepoisDaTroca(e: {
  troca: VersaoPropria
  versoesDoVideo: readonly VersaoPropria[]
  dias: readonly DiaAlcance[]
  publicadoEm: DiaYt | null
  regras?: RegrasTroca
}): LeituraDaTroca {
  const regras = e.regras ?? PROPRIO_RULES
  const { troca } = e
  if (troca.origem === 'linha_de_base' || troca.preRegistro || troca.campo === 'desc' || troca.janela === null) return { estado: 'nao_se_aplica' }
  if (ehRetoque(troca) && !regras.retoqueContaComoTroca) return { estado: 'nao_se_aplica' }
  if (troca.origem === 'ab_lab' && troca.eventoAb === 'rotacao') return { estado: 'em_teste_ab' }

  // Os dias que "encostam" na troca vêm dos instantes da janela, não de `primeiroDia` (a linha do dia D é capturada em D+1).
  const inicio = dayPt(new Date(troca.janela.de))
  const fim = dayPt(new Date(troca.janela.ate))
  const J = regras.trocaJanelaDias
  let antesDe = addDays(inicio, -J), antesAte = addDays(inicio, -1)
  let depoisDe = addDays(fim, 1), depoisAte = addDays(fim, J)
  let cortada = false

  // Vizinhas: troca de título ou thumbnail do mesmo vídeo (a rotação do Lab conta; descrição, linha de base, pré-registro e retoque não).
  for (const v of e.versoesDoVideo) {
    if (v.id === troca.id || v.janela === null || v.origem === 'linha_de_base' || v.preRegistro) continue
    if (v.campo === 'desc' || (ehRetoque(v) && !regras.retoqueContaComoTroca)) continue
    const fimV = Date.parse(v.janela.ate), fimT = Date.parse(troca.janela.ate)
    if (fimV > fimT) {
      const limite = addDays(dayPt(new Date(v.janela.de)), -1)
      if (limite < depoisAte) { depoisAte = limite; cortada = true }
    } else if (fimV < fimT) {
      const limite = addDays(dayPt(new Date(v.janela.ate)), 1)
      if (limite > antesDe) { antesDe = limite; cortada = true }
    }
  }

  const fora = (d: DiaYt): boolean => e.publicadoEm !== null && d === e.publicadoEm
  const candAntes = diasDe(antesDe, antesAte).filter(d => !fora(d))
  const candDepois = diasDe(depoisDe, depoisAte).filter(d => !fora(d))
  const primeiroLido = e.dias.reduce<DiaYt | null>((m, d) => (m === null || d.dia < m ? d.dia : m), null)
  if (candAntes.length > 0 && (primeiroLido === null || candAntes.every(d => d < primeiroLido))) return { estado: 'antes_fora_da_janela_lida' }

  const porDia = new Map(e.dias.map(d => [d.dia, d]))
  const antes = medir(candAntes, porDia), depois = medir(candDepois, porDia)
  if (antes.diasMedidos === 0) return { estado: 'sem_antes', antes, depois, cortada }
  if (depois.diasMedidos === 0) return { estado: 'depois_nao_medido', antes, depois, cortada }
  if (antes.imp < regras.trocaMinImpressoesPorLado || depois.imp < regras.trocaMinImpressoesPorLado) return { estado: 'ainda_nao_da', antes, depois, cortada }

  const fa = wilson(antes.cliquesEst, antes.imp), fd = wilson(depois.cliquesEst, depois.imp)
  if (fa === null || fd === null) return { estado: 'ainda_nao_da', antes, depois, cortada } // dado impossível: não inventa leitura
  antes.taxa = antes.cliquesEst / antes.imp; antes.lo = fa.lo; antes.hi = fa.hi
  depois.taxa = depois.cliquesEst / depois.imp; depois.lo = fd.lo; depois.hi = fd.hi
  const leitura = fd.lo > fa.hi ? 'subiu' : fd.hi < fa.lo ? 'caiu' : 'sem_diferenca_firme'
  return { estado: 'com_leitura', antes, depois, cortada, leitura }
}
