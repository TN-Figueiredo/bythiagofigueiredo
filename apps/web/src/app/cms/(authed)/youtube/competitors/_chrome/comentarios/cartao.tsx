'use client'
// A5 · E5a · Tarefa C2 (refeita em "comentários em produção", T4): o cartão do vídeo é um envoltório fino do fio único. O que só o vídeo tem
// (avisos de corte e endereço, escada de canal grande, "não vimos / não sabemos", "saiu do YouTube") vai no encaixe `extra`.
// Texto de terceiros é SEMPRE nó de texto React num bloco `dir="auto"` (dentro do `FioDeComentario`): nunca HTML, nunca link.
import { FioDeComentario } from './fio'
import type { CriadorDoFio } from './fio-model'
import { FRASES } from './frases'
import type { CartaoEnxuto, ExtraView } from './enxuto'
import './comentarios.css'

function Degraus({ rotulo, n }: { rotulo: string; n: number }) {
  return (
    <p className="cd-degraus">
      <span className="cd-deg" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
      <span>{rotulo}</span>
    </p>
  )
}

function Extra({ v, hrefFilaSaiu }: { v: ExtraView; hrefFilaSaiu?: string }) {
  const { semResposta } = v
  const itens = [
    v.cortado ? <p key="corte" className="cd-nota">{FRASES.cortadoAos}</p> : null,
    v.temEndereco ? <p key="url" className="cd-nota">{FRASES.temEndereco}</p> : null,
    semResposta ? <p key="sem" className="cd-nota">{semResposta}</p> : null,
    v.base ? (
      <div key="base" className="cd-base">
        {v.base.tamanho ? <Degraus rotulo={v.base.tamanho.texto} n={v.base.tamanho.degrau} /> : null}
        {v.base.razao === 'nao_medida'
          ? <p><span className="obs-ch-nm cd-selo" title={FRASES.razaoNaoMedidaLonga}>{FRASES.razaoNaoMedida}</span> <span className="cd-nota">{FRASES.razaoNaoMedidaLonga}</span></p>
          : <Degraus rotulo={v.base.razao.texto} n={v.base.razao.degrau} />}
      </div>
    ) : null,
    v.saiu ? (
      <p key="saiu" className="cd-saiu">
        <span className="cd-selo cd-selo-erro">{v.saiu}</span>
        {hrefFilaSaiu ? <> <a className="cd-link" href={hrefFilaSaiu}>{FRASES.verNaFila}</a></> : null}
      </p>
    ) : null,
  ].filter(x => x !== null)
  return itens.length > 0 ? <>{itens}</> : null
}

export function Cartao({ v, criador, escondido = false, hrefFilaSaiu }: { v: CartaoEnxuto; criador: CriadorDoFio; escondido?: boolean; hrefFilaSaiu?: string }) {
  const extra = Extra({ v: v.extra, hrefFilaSaiu })
  return <FioDeComentario v={v.fio} criador={criador} densidade="cartao" escondido={escondido} extra={extra} />
}
