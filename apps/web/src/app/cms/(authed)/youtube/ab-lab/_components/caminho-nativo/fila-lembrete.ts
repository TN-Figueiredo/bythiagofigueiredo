'use client'
// Fila offline do "Lembrar no computador" (F1a-tela-1, T9b). Item = `{ fichaId, enfileiradoEm }` em `localStorage['ab-lab:lembrete-fila']`:
// só o id da ficha, NUNCA título nem URL. Todo acesso ao storage é em try/catch (storage bloqueado = fila vazia, sem erro na tela).
// `drenar` roda ao montar a lista, em `online` e em `visibilitychange` visível; descarta o item com mais de 14 d ou quando a action
// diz "não encontrado" (a ficha já virou teste). Um dreno por vez: gatilhos simultâneos não chamam a mesma ficha duas vezes.
import { useEffect, useRef } from 'react'

export const CHAVE_FILA_LEMBRETE = 'ab-lab:lembrete-fila'
export const VALIDADE_FILA_MS = 14 * 86_400_000
/** Mesma frase de `MSG_NAO_ENCONTRADO` (servidor): a ficha já virou teste ou sumiu. */
const NAO_ENCONTRADO = 'não encontrado'

export interface ItemFilaLembrete { fichaId: string; enfileiradoEm: string }
export type LembrarDaFila = (fichaId: string) => Promise<{ ok: boolean; error?: string }>

export function lerFila(): ItemFilaLembrete[] {
  try {
    const bruto = window.localStorage.getItem(CHAVE_FILA_LEMBRETE)
    if (!bruto) return []
    const v: unknown = JSON.parse(bruto)
    if (!Array.isArray(v)) return []
    return v.filter((x): x is ItemFilaLembrete => typeof x === 'object' && x !== null
      && typeof (x as ItemFilaLembrete).fichaId === 'string' && typeof (x as ItemFilaLembrete).enfileiradoEm === 'string')
      .map((x) => ({ fichaId: x.fichaId, enfileiradoEm: x.enfileiradoEm }))
  } catch { return [] }
}

function gravar(fila: ItemFilaLembrete[]): void {
  try {
    if (fila.length === 0) window.localStorage.removeItem(CHAVE_FILA_LEMBRETE)
    else window.localStorage.setItem(CHAVE_FILA_LEMBRETE, JSON.stringify(fila))
  } catch { /* storage bloqueado: o lembrete simplesmente não fica na fila */ }
}

export function enfileirar(fichaId: string, agora: Date = new Date()): void {
  const fila = lerFila()
  if (fila.some((i) => i.fichaId === fichaId)) return
  gravar([...fila, { fichaId, enfileiradoEm: agora.toISOString() }])
}

const tirar = (fichaId: string): void => gravar(lerFila().filter((i) => i.fichaId !== fichaId))

let drenando = false

export async function drenar(lembrar: LembrarDaFila, agora: Date = new Date()): Promise<void> {
  if (drenando) return
  drenando = true
  try {
    for (const item of lerFila()) {
      const idade = agora.getTime() - Date.parse(item.enfileiradoEm)
      if (!Number.isFinite(idade) || idade > VALIDADE_FILA_MS) { tirar(item.fichaId); continue }
      try {
        const r = await lembrar(item.fichaId)
        if (r.ok || r.error === NAO_ENCONTRADO) tirar(item.fichaId)
      } catch { /* sem rede ou erro do servidor: o item fica para a próxima vez */ }
    }
  } finally { drenando = false }
}

export function useDrenarFilaLembrete(lembrar: LembrarDaFila, agora: () => Date = () => new Date()): void {
  const ref = useRef({ lembrar, agora })
  ref.current = { lembrar, agora }
  useEffect(() => {
    const rodar = (): void => { void drenar((id) => ref.current.lembrar(id), ref.current.agora()) }
    const aoVisivel = (): void => { if (document.visibilityState === 'visible') rodar() }
    rodar()
    window.addEventListener('online', rodar)
    document.addEventListener('visibilitychange', aoVisivel)
    return () => { window.removeEventListener('online', rodar); document.removeEventListener('visibilitychange', aoVisivel) }
  }, [])
}
