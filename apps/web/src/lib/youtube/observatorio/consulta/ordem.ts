// A4 R3, T5: a ordem da consulta. Estável (o empate fica na ordem do motor, que é a ordem de entrada) e com os nulos sempre no fim.
// As regras de grupo são as da tela: vpd7 pela chave da Outliers (`chaveDeVpd`), multiplicador com a base fraca depois das sólidas,
// engajamento com `idade_30` antes de `total_de_hoje`.
import { chaveDeVpd } from '../outliers'
import type { LinhaDaConsulta, PedidoDaConsulta } from './tipos'

interface Chave { grupo: number; x: number }

export function ordenar(linhas: LinhaDaConsulta[], p: PedidoDaConsulta, ctx: { canalAtrasado: (canalId: string) => boolean }): LinhaDaConsulta[] {
  const sinal = p.direcao === 'asc' ? 1 : -1
  const chave = (l: LinhaDaConsulta): Chave => {
    const c = l.celulas[p.ordenarPor]
    if (p.ordenarPor === 'vpd7') {
      // a mesma chave da tela: canal atrasado ou com erro no fim (-2), depois o sem taxa (-1); a taxa desde a publicação entra no lugar do vpd7
      const sync = ctx.canalAtrasado(l.canalId) ? 'atrasado' : 'ok'
      const k = chaveDeVpd(sync, !c || c.x === null ? { vpd7: null, vpd: null } : c.vpdBase === 'desde_publicacao' ? { vpd7: null, vpd: c.x } : { vpd7: c.x, vpd: null })
      return k === -2 ? { grupo: 100, x: 0 } : k === -1 ? { grupo: 99, x: 0 } : { grupo: 0, x: k }
    }
    if (!c || c.x === null) return { grupo: 99, x: 0 }
    if (p.ordenarPor === 'multiplicador') return { grupo: l.baseFraca && !p.incluirBaseFraca ? 1 : 0, x: c.x }
    if (p.ordenarPor === 'engajamento') return { grupo: c.base === 'total_de_hoje' ? 1 : 0, x: c.x }
    return { grupo: 0, x: c.x }
  }
  return linhas
    .map((l, i) => ({ l, i, k: chave(l) }))
    .sort((a, b) => a.k.grupo - b.k.grupo || (a.k.grupo >= 99 ? 0 : sinal * (a.k.x - b.k.x)) || a.i - b.i)
    .map((e) => e.l)
}
