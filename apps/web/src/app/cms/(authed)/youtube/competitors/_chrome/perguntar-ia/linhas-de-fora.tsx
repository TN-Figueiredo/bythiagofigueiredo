'use client'
// A5 · E17 degrau 1, Tarefa 10: as quatro linhas "O que ficou de fora". Sempre as mesmas quatro; só o estado muda.
import type { ReactNode } from 'react'
import type { PacoteSerializado } from '@/lib/youtube/observatorio/contexto-ia/segmentar'
import * as F from './frases-do-dialogo'
import { Icones } from './info'

type Classe = 'ok' | 'cut' | 'lock' | 'na' | 'nunca'

function Linha({ cls, icone, titulo, status, detalhe }: { cls: Classe; icone: ReactNode; titulo: string; status: string; detalhe?: ReactNode }) {
  return (
    <li className={`pi-fr ${cls}`}>
      <span className="pi-fr-i">{icone}</span>
      <span className="pi-fr-t">{titulo}</span>
      <span className={`pi-stc ${cls}`}>{status}</span>
      {detalhe ? <div className="pi-fr-d">{detalhe}</div> : null}
    </li>
  )
}

export interface CorteDaLinha { rotulo: string; caracteres: number }

export function motivoDoPrivado(p: PacoteSerializado['privado']): string | null {
  if (p.estado !== 'excluido') return null
  return p.motivo === 'sem_direito' ? F.SEM_O_DIREITO : p.motivo === 'nao_conferido' ? F.NAO_FOI_POSSIVEL_CONFERIR : F.A_LEITURA_FALHOU
}

export function LinhasDeFora({ cabe, cortes, privado, comentarios }: { cabe: boolean; cortes: readonly CorteDaLinha[]; privado: PacoteSerializado['privado']; comentarios: PacoteSerializado['comentarios'] }) {
  const motivo = motivoDoPrivado(privado)
  return (
    <ul className="pi-forals">
      {cabe ? (
        <Linha cls="ok" icone={<Icones.ok />} titulo={F.POR_TAMANHO} status={F.POR_TAMANHO_NADA} />
      ) : (
        <Linha cls="cut" icone={<Icones.corte />} titulo={F.POR_TAMANHO} status={F.POR_TAMANHO_CORTADO} detalhe={
          <ul className="pi-cortes" aria-label={F.CORTES_ARIA}>
            {cortes.map((c) => <li key={c.rotulo}><span>{c.rotulo}</span><span className="pi-cn"><b className="num">{F.milhar(c.caracteres)}</b> caracteres</span></li>)}
          </ul>
        } />
      )}
      {privado.estado === 'na' ? (
        <Linha cls="na" icone={<Icones.nao />} titulo={F.DADO_PRIVADO} status={F.ESTA_TELA_NAO_TEM} />
      ) : privado.estado === 'incluido' ? (
        <Linha cls="ok" icone={<Icones.ok />} titulo={F.DADO_PRIVADO} status={F.INCLUIDO} detalhe={privado.itens} />
      ) : (
        <Linha cls="lock" icone={<Icones.cadeado />} titulo={F.DADO_PRIVADO} status={motivo ?? F.SEM_O_DIREITO} detalhe={F.deFora(privado.itens)} />
      )}
      {comentarios.estado === 'na' ? (
        <Linha cls="na" icone={<Icones.nao />} titulo={F.TEXTO_DE_COMENTARIOS} status={F.ESTA_TELA_NAO_TEM} />
      ) : comentarios.estado === 'incluido' ? (
        <Linha cls="ok" icone={<Icones.ok />} titulo={F.TEXTO_DE_COMENTARIOS} status={F.INCLUIDO} detalhe={F.comentariosIncluidos(comentarios.quantos)} />
      ) : (
        <Linha cls="lock" icone={<Icones.cadeado />} titulo={F.TEXTO_DE_COMENTARIOS} status={motivo ?? F.SEM_O_DIREITO} detalhe={F.comentariosDeFora(comentarios.quantos)} />
      )}
      <Linha cls="nunca" icone={<Icones.nunca />} titulo={F.CHAVES} status={F.NUNCA_ENTRAM} />
    </ul>
  )
}
