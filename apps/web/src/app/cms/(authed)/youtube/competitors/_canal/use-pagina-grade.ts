/**
 * Quantos lotes de 24 da grade de Capas a pessoa pediu ("Mostrar mais" a 480 px ou menos, `grade-paginacao.ts`). Mora na tela (não na aba) para o Voltar do
 * Histórico poder subir o número antes de focar um cartão que a grade recém-montada ainda esconde. Filtro, ordem, direção e busca recomeçam na primeira
 * página (o estado é trocado durante o render, no padrão do React para estado derivado de prop).
 */
import { useCallback, useState } from 'react'

export interface PaginaGradeEstado { lotes: number; setLotes: (lotes: number) => void }

export function usePaginaGrade(state: { fmt: string; sort: string; dir: string; q: string }): PaginaGradeEstado {
  const chave = `${state.fmt}|${state.sort}|${state.dir}|${state.q}`
  const [pag, setPag] = useState({ chave, lotes: 1 })
  if (pag.chave !== chave) setPag({ chave, lotes: 1 })
  const setLotes = useCallback((lotes: number) => setPag({ chave, lotes }), [chave])
  return { lotes: pag.chave === chave ? pag.lotes : 1, setLotes }
}
