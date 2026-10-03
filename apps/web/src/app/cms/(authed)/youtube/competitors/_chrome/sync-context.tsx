'use client'
/**
 * Whether the chrome's "Sincronizar concorrentes" round is running (ruling R42). The chrome owns the round; screens
 * read it to show their own in-progress state (Canais: the .syncbar of canais.html).
 */
import { createContext, useContext } from 'react'

export interface ChromeSync { running: boolean }
export const ChromeSyncContext = createContext<ChromeSync>({ running: false })
export const useChromeSync = (): ChromeSync => useContext(ChromeSyncContext)
