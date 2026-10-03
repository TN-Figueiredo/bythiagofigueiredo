'use client'
/**
 * The chrome tells a screen that its forja header button was clicked when the screen owns the next step (Mudanças:
 * the inline preview + "Confirmar pedido", mudancas.html I5). `seq` grows on every click; 0 = never clicked.
 */
import { createContext, useContext } from 'react'

export const ForjaHeaderContext = createContext<{ seq: number }>({ seq: 0 })
export const useForjaHeaderClick = (): number => useContext(ForjaHeaderContext).seq
