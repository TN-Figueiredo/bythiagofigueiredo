'use client'
// Ficha carregando (mockup `ficha-carregando`): cabeçalho real (o título já é conhecido), frase de estado, esqueleto com a altura da ficha
// pronta (--cn-hf) e "Carregando a ficha…". Gio F-5.
import type { ReactElement } from 'react'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { Icone } from './icones'
import { useLargura } from './ficha-teste'
import '../caminho-nativo.css'
import '../ficha-teste.css'
import '../lista-caminho.css'

export function FichaEsqueleto({ l, fechar }: { l: Pick<LinhaDoCaminho, 'titulo' | 'miniaturaUrl'>; fechar: () => void }): ReactElement {
  const estreita = useLargura() === 'estreita'
  const frase = estreita ? FRASES.ficha.carregandoEstreita : FRASES.ficha.carregando
  return (
    <section className="cn-ficha" aria-labelledby="cn-fh" aria-busy="true">
      <div className="cn-fin">
        <div className="cn-fbar">
          {estreita ? (
            <button type="button" className="cn-btn ghost" onClick={fechar}><Icone nome="back" />{FRASES.ficha.voltarALista}</button>
          ) : (
            <>
              <span className="cn-crumb">{FRASES.ficha.crumb}</span>
              <button type="button" className="cn-btn ghost" onClick={fechar} aria-label="Fechar a ficha (Esc)"><Icone nome="x" />{FRASES.ficha.fechar}</button>
            </>
          )}
        </div>
        <div className="cn-fhd">
          {l.miniaturaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="cn-fth" src={l.miniaturaUrl} alt="" />
          ) : null}
          <div className="cn-ttl">
            <p className="cn-crumb">{FRASES.ficha.testarNoYoutube}</p>
            <h2 id="cn-fh" tabIndex={-1}>{l.titulo}</h2>
          </div>
        </div>
        <p className="cn-fsum">
          {frase.frase}
          {frase.apoio ? <small>{frase.apoio}</small> : null}
        </p>
        <div className="cn-fsk"><span className="cn-skel" /></div>
        <p className="cn-meta cn-fsk-meta" role="status">{FRASES.ficha.carregandoMeta}</p>
      </div>
    </section>
  )
}
