'use client'
// Hospedeiro do "Mudar minha resposta" (F1a-tela-2, T7): mostra o bloco (respondido ou conflito) com o link; ao tocar, o bloco dá lugar
// à pergunta do dia 14 em `modo: 'mudar'` (sem 2º toque). Depois de gravar, espera a linha reler para voltar ao bloco novo.
import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { Dia14Pergunta, type AcoesDia14 } from './dia-14-pergunta'
import type { PerguntaDoDia14 } from './dia-14-estado'

/** Sem o dado mudar depois do ok (resposta já gravada), o bloco volta sozinho depois disto. */
const ESPERA_RELEITURA_MS = 3000

const assinatura = (r: NonNullable<LinhaDoCaminho['registro']>): string =>
  JSON.stringify([r.respostaDono, r.varianteVencedora, r.respostaMudadaEm, r.updatedAt])

export interface Dia14MudarProps {
  linha: LinhaDoCaminho
  pergunta: PerguntaDoDia14
  acoes: AcoesDia14
  /** O bloco; recebe o link "Mudar minha resposta" para colocar onde quiser. */
  children: (link: ReactElement) => ReactNode
}

export function Dia14Mudar({ linha, pergunta, acoes, children }: Dia14MudarProps): ReactElement | null {
  const reg = linha.registro
  const [mudando, setMudando] = useState(false)
  const [gravou, setGravou] = useState<string | null>(null)
  const linkRef = useRef<HTMLButtonElement>(null)
  const voltou = useRef(false)

  const voltar = useCallback((): void => { voltou.current = true; setGravou(null); setMudando(false) }, [])
  const sig = reg ? assinatura(reg) : ''
  // A linha releu com o dado novo: volta ao bloco (que agora mostra a resposta nova).
  useEffect(() => { if (mudando && gravou !== null && sig !== gravou) voltar() }, [mudando, gravou, sig, voltar])
  // Sem mudança de dado (a resposta pedida já estava gravada), não deixa a tela presa na confirmação.
  useEffect(() => {
    if (gravou === null) return
    const t = setTimeout(voltar, ESPERA_RELEITURA_MS)
    return () => clearTimeout(t)
  }, [gravou, voltar])
  // Ao voltar ao bloco, o foco vai para o link (a pergunta que tinha o foco acabou de desmontar).
  useEffect(() => {
    if (mudando || !voltou.current) return
    voltou.current = false
    linkRef.current?.focus()
  }, [mudando])

  if (!reg) return null
  if (mudando && reg.respostaDono) {
    return (
      <Dia14Pergunta
        linha={linha} pergunta={pergunta} modo="mudar" respostaVista={reg.respostaDono} varianteVista={reg.varianteVencedora}
        acoes={{ ...acoes, aoMudou: () => { acoes.aoMudou?.(); setGravou(sig) } }}
        aoFechar={() => { voltou.current = true; setMudando(false) }}
      />
    )
  }
  const link = (
    <button type="button" className="cn-lnk" data-acao="mudar-resposta" ref={linkRef} onClick={() => setMudando(true)}>{FRASES.respondido.mudar}</button>
  )
  return <>{children(link)}</>
}
