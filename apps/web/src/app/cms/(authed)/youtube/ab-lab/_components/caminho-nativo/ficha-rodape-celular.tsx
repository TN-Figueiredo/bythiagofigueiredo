'use client'
// Rodapé fixo da ficha a 390 px (F1a-tela-1, T9b): "Lembrar no computador". Online: `lembrarNoComputador` pela fila da ficha (o `atualizada_em`
// devolvido é adotado). Offline (ou rede caiu na chamada): o `fichaId` entra na fila local e sai quando a conexão voltar (`fila-lembrete.ts`).
import { useEffect, useState, type ReactElement } from 'react'
import type { ResultadoLembrar } from '@/lib/youtube/teste-youtube/nativo/ficha'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { ContextoFicha } from './ficha-teste'
import { dataHora } from './ficha-faixas'
import { enfileirar } from './fila-lembrete'
import { Icone } from './icones'
import '../caminho-nativo.css'
import '../ficha-teste.css'

const semRede = (): boolean => typeof navigator !== 'undefined' && navigator.onLine === false

function useOnline(): boolean {
  const [off, setOff] = useState(semRede)
  useEffect(() => {
    const a = (): void => setOff(semRede())
    window.addEventListener('online', a); window.addEventListener('offline', a)
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', a) }
  }, [])
  return !off
}

export function RodapeCelular({ ctx, lembrar, agora }: {
  ctx: ContextoFicha
  lembrar: (fichaId: string) => Promise<ResultadoLembrar>
  agora: () => Date
}): ReactElement | null {
  const online = useOnline()
  const [enviando, setEnviando] = useState(false)
  const [naFila, setNaFila] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [lembradoEm, setLembradoEm] = useState<string | null>(null)
  const lembrado = ctx.ficha.lembrar_em ?? lembradoEm
  const L = FRASES.ficha.rodapeLembrete
  const semB = ctx.vista.motivoDesabilitado === L.semB

  const tocar = async (): Promise<void> => {
    if (enviando) return
    setErro(null)
    if (!online) { enfileirar(ctx.ficha.id, agora()); setNaFila(true); return }
    setEnviando(true)
    try {
      const r = await ctx.executar<ResultadoLembrar>(() => lembrar(ctx.ficha.id))
      // Se a action devolveu a ficha, a fila da ficha já a adotou (com o `atualizada_em` novo); a data vale na tela de qualquer forma.
      if (r.ok) setLembradoEm(r.lembrarEm)
      else setErro(FRASES.ficha.lembreteFalhou)
    } catch {
      enfileirar(ctx.ficha.id, agora()); setNaFila(true)
    } finally { setEnviando(false) }
  }

  if (lembrado) {
    return (
      <div className="cn-foot" role="status">
        <p className="cn-sent"><Icone nome="bell" />{FRASES.ficha.lembreteEnviado(dataHora(new Date(lembrado)))}</p>
        <p>{L.abraPeloSino}</p>
      </div>
    )
  }
  return (
    <div className="cn-foot">
      <button type="button" className={`cn-btn${ctx.vista.primario === 'lembrar' ? ' pri' : ''}`} disabled={semB || enviando} aria-busy={enviando || undefined}
        onClick={() => { void tocar() }}><Icone nome="bell" />{L.lembrar}</button>
      <p>{semB ? L.semB : naFila ? L.offline : L.chega}</p>
      {erro ? <p className="cn-errl" role="alert"><Icone nome="warn" /><span>{erro}</span></p> : null}
    </div>
  )
}
