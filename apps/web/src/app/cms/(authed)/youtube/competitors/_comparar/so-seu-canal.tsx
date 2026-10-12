'use client'
/**
 * O cartão "Só o seu canal mede" (A4 Tarefa 14, mockup aprovado em 12/10), logo abaixo dos dois lados e antes de "Número a número". Um cartão por lado
 * que é canal seu; nenhum lado seu = nada no DOM (e nenhum hook que gaste id: o HTML dos blocos de baixo continua byte a byte o mesmo de antes).
 * Chega do servidor só TEXTO pronto (`SoSeuCanalView`): quem não edita o site só recebe a frase do motivo. Os valores são do canal próprio (`--lado-o`,
 * a cor de "seu canal"); valor fraco em cinza; não medido é só o quadradinho hachurado. Este cartão não usa verde nem âmbar: não diz direção.
 */
import { Fragment, useId, useMemo, useRef, useState } from 'react'
import { Popover } from '../_chrome/flut/flut'
import { Icon } from '../_chrome/icons'
import { TaxaFaixa } from '../_proprio/taxa-faixa'
import { buildTaxaFaixa } from '../_proprio/taxa-faixa-model'
import { taxaComIntervalo } from '@/lib/youtube/observatorio/proprio/taxa'
import type { CompararPack } from './pack'
import type { ParView } from './par-model'
import {
  buildSoSeuCanal, INFO_SO_SEU_CANAL, NEGRITO_NAO_ZERO, PREFIXO_NAO_MEDIDO, type SoSeuCanalView,
} from './so-seu-canal-model'

/** A frase com o seu negrito: "Não medido." na abertura do estado sem dado, "não porque sejam zero" no fim do estado normal. */
function Frase({ texto }: { texto: string }) {
  if (texto.startsWith(PREFIXO_NAO_MEDIDO)) return <><b>{PREFIXO_NAO_MEDIDO}</b>{texto.slice(PREFIXO_NAO_MEDIDO.length)}</>
  const i = texto.indexOf(NEGRITO_NAO_ZERO)
  if (i < 0) return <>{texto}</>
  return <>{texto.slice(0, i)}<b>{NEGRITO_NAO_ZERO}</b>{texto.slice(i + NEGRITO_NAO_ZERO.length)}</>
}

/** A faixa da taxa de clique: o componente do canal, recalculando o intervalo dos dois números que a View leva. */
function FaixaDaTaxa({ taxa }: { taxa: NonNullable<SoSeuCanalView['taxa']> }) {
  const t = taxaComIntervalo(taxa.cliques, taxa.imp)
  if (!t) return null
  return <TaxaFaixa view={buildTaxaFaixa({ alvo: t, canal: null, alt: taxa.alt })} />
}

function Cartao({ v, unico }: { v: SoSeuCanalView; unico: boolean }) {
  const base = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const tid = 'so' + base, dica = 'sod' + base
  const [aberta, setAberta] = useState(false)
  const botao = useRef<HTMLButtonElement>(null)
  return (
    <section className="so" data-so-seu-canal="" aria-labelledby={tid}>
      <h2 id={tid}>
        Só o seu canal mede{unico ? '' : `: ${v.canal}`}
        <button ref={botao} type="button" className="ibtn" aria-expanded={aberta} aria-controls={dica} aria-label={INFO_SO_SEU_CANAL.titulo} onClick={() => setAberta(o => !o)}>{Icon.info()}</button>
      </h2>
      <Popover open={aberta} anchor={() => botao.current} onClose={() => setAberta(false)} id={dica} role="dialog" labelledBy={dica + 't'} className="cp-tip" pref="baixo" align="inicio" maxW={400}>
        <h3 id={dica + 't'}>{INFO_SO_SEU_CANAL.titulo}</h3>
        <ul>{INFO_SO_SEU_CANAL.itens.map(i => <li key={i.forte}><b>{i.forte}</b> {i.texto}</li>)}</ul>
      </Popover>
      <p className="so-lead">
        {v.naoMedido ? <span className="obs-ch-nm so-nm" aria-hidden="true" /> : null}
        <span><Frase texto={v.frase} /></span>
      </p>
      {v.linhas.length > 0 ? (
        <ul className="so-linhas">
          {v.linhas.map(l => (
            <li key={l.chave} data-linha={l.chave}>
              <div className="so-rt">{l.rotulo}<small>{l.sub}</small></div>
              <div className="so-val">
                {l.valor != null
                  ? <span className={'so-vl num' + (l.fraco ? ' fraco' : '')}>{l.valor}{l.nota ? <small>{l.nota}</small> : null}</span>
                  : <Fragment><span className="obs-ch-nm so-nm" role="img" aria-label="não medido" />{l.nota ? <small className="so-nota">{l.nota}</small> : null}</Fragment>}
                {l.chave === 'taxa' && v.taxa ? <FaixaDaTaxa taxa={v.taxa} /> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export function SoSeuCanal({ pack, par }: { pack: CompararPack; par: ParView }) {
  // a View é escolhida aqui, no navegador, a partir do pacote já montado no servidor: trocar o seletor ou inverter os lados não vai à rede
  const views = useMemo(() => buildSoSeuCanal({ a: par.a, b: par.b }, pack.soSeuCanal), [par.a, par.b, pack.soSeuCanal])
  if (views.length === 0) return null
  return <>{views.map(v => <Cartao key={v.canal} v={v} unico={views.length === 1} />)}</>
}
