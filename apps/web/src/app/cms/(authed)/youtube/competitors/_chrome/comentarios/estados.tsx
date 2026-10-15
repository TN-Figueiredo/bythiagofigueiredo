'use client'
// A5 · E5a · Tarefa C2: os estados sem lista. Nenhum mostra o algarismo 0, salvo o "zero medido".
import { useRouter } from 'next/navigation'
import { FRASES } from './frases'
import type { EstadoView, SeloView } from './model'
import './comentarios.css'

function Selo({ s }: { s: SeloView }) {
  const classe = s.forma === 'zero' ? 'obs-ch-zero' : s.forma === 'nm' ? 'obs-ch-nm' : s.forma === 'pontilhado' ? 'obs-md-ainda' : 'cd-selo-erro'
  return <span className={`cd-selo ${classe}`}>{s.texto}</span>
}

function Tentar() {
  const router = useRouter()
  return <button type="button" className="cd-tentar" onClick={() => router.refresh()}>{FRASES.tentarDeNovo}</button>
}

export function EstadoDoPainel({ v }: { v: EstadoView }) {
  const erro = v.tom === 'erro'
  return (
    <div className={`cd-estado cd-tom-${v.tom}`} role={erro ? 'alert' : undefined}>
      <p className="cd-estado-t"><strong>{v.titulo}</strong>{v.corpo ? <> {v.corpo}</> : null}</p>
      {v.selo ? <p className="cd-estado-s"><Selo s={v.selo} /></p> : null}
      {v.nota ? <p className="cd-estado-n">{v.nota}</p> : null}
      {v.tentar ? <Tentar /> : null}
    </div>
  )
}

export function Carregando() {
  return <div className="cd-estado cd-tom-pontilhado" role="status" aria-busy="true"><p className="cd-estado-t">{FRASES.carregando}</p></div>
}
