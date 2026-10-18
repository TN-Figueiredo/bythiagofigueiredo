'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { TestesAbertos } from './testes-abertos'

export interface AbEntradas { podeEditar: true; abertos: TestesAbertos | null }

const Contexto = createContext<AbEntradas | null>(null)

/** Fora do provedor, ou com `valor` nulo (reporter), nada das entradas do A/B aparece. */
export function AbEntradasProvider({ valor, children }: { valor: AbEntradas | null; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useAbEntradas(): AbEntradas | null {
  return useContext(Contexto)
}
