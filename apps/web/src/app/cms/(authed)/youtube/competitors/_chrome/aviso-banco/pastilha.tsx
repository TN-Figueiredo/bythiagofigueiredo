'use client'
import { useRef, useState, type ReactElement } from 'react'
import { Popover } from '../flut/flut'
import type { AvisoV2 } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-v2'
import { FormaBl } from './formas'
import { PainelAvisoBanco } from './painel'
import './aviso-banco.css'

/** A pastilha do banco na faixa de frescor, MAIS as marcas AO LADO dela (irmãs, nunca filhas). Quebram linha juntas a 390 px (a faixa tem flex-wrap). */
export function AvisoBancoNaFaixa({ aviso, arquivoHref }: { aviso: AvisoV2; arquivoHref: string }): ReactElement {
  const [aberto, setAberto] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const { pastilha, marcas } = aviso
  const cls = pastilha.cor === 'ambar' ? 'amarelo' : pastilha.cor === 'vermelho' ? 'vermelho' : pastilha.cor === 'nao_medido' ? 'vazia' : 'verde'
  const forma = pastilha.cor === 'vermelho' ? 'octogono' : pastilha.cor === 'ambar' ? 'triangulo' : pastilha.cor === 'nao_medido' ? 'hachura' : 'visto'
  const m = marcas.canaisRemovidos
  return (
    <>
      <div className="bl-fn">
        <button ref={btn} type="button" className={'bl-p ' + cls} aria-expanded={aberto} aria-controls={aberto ? 'obs-bl-pop' : undefined} onClick={() => setAberto(a => !a)} data-testid="pastilha-banco">
          <FormaBl forma={forma} /><span>Banco{pastilha.pct !== null ? ` ${pastilha.pct}%` : ''}: {pastilha.texto}</span>
        </button>
        <Popover open={aberto} anchor={() => btn.current} onClose={() => setAberto(false)} id="obs-bl-pop" className="obs-ch-pop bl-pop" role="dialog" label="Aviso do banco" align="inicio" maxW={680}>
          <PainelAvisoBanco aviso={aviso} arquivoHref={arquivoHref} />
        </Popover>
      </div>
      {m ? (
        <a className={'bl-ch ' + (m.forma === 'octogono' ? 'vermelho' : m.forma === 'triangulo' ? 'amarelo' : 'cinza')} href={arquivoHref} data-testid="marca-canais-removidos">
          <FormaBl forma={m.forma} /><span>{m.n === 1 ? '1 canal removido pede um comando seu' : `${m.n} canais removidos pedem um comando seu`}</span>
        </a>
      ) : null}
    </>
  )
}
