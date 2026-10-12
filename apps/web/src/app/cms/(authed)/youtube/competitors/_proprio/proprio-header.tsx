'use client'
/**
 * Cabeçalho da página do canal próprio (spec 16.2 e 16.3, mockup canal-proprio.html): avatar, nome, o selo "seu canal" no lugar do nicho, o @,
 * "Comparar com…" ao lado de "Abrir no YouTube"; a faixa de seis números; a linha de sincronização com o ⓘ e "Todos os números"; a linha
 * de posição com os links; as onze células abaixo. Reaproveita a célula, o ícone e as classes do cabeçalho do concorrente (`canal.css`); o que é só
 * do próprio mora em `proprio.css`. Nenhum menu ⋯: o canal próprio sincroniza pelo Painel e não se remove daqui. Dado ausente mostra a frase em
 * `.obs-ch-nm`, nunca "0" nem "—". O `Link` é importado aqui, no módulo cliente (Next 16: nenhum Link chega por prop).
 */
import Link from 'next/link'
import { useRef, useState, type ReactNode } from 'react'
import { ChannelAvatar } from '../_chrome/channel-avatar'
import { cliqueSimples } from '../_chrome/clique-simples'
import { Popover } from '../_chrome/flut/flut'
import { lembrarGatilho } from '../_chrome/gatilho-volta'
import { Icon } from '../_chrome/icons'
import { cap, Cell, Ext } from '../_canal/canal-header'
import type { PosicaoItem, ProprioHeaderView } from './header-model'

/** Um item da linha de posição: link para a lista de Canais ordenada quando ela ordena por ele; texto quando não. */
function Item({ i }: { i: PosicaoItem }) {
  return i.href ? <Link href={i.href} prefetch={false}>{i.texto}</Link> : <>{i.texto}</>
}

function Posicao({ h }: { h: NonNullable<ProprioHeaderView['posicaoItens']> }) {
  const [a, b, c, e] = h.itens
  const dois = (x: PosicaoItem | undefined, fim: string): ReactNode => (x ? <><Item i={x} />{fim}</> : null)
  return <p className="pos">{h.intro} {dois(a, ', ')}{dois(b, ', ')}{dois(c, '. ')}{dois(e, '.')}</p>
}

export function ProprioHeader({ h, nums, onToggleNums, compararHref, compararTitulo }: {
  h: ProprioHeaderView; nums: boolean; onToggleNums: () => void
  /** A comparação com o concorrente logo acima em inscritos; null = sem concorrente: o botão não existe. */
  compararHref: string | null; compararTitulo: string | null
}) {
  const [tip, setTip] = useState(false)
  const tipBtn = useRef<HTMLButtonElement>(null)
  const cells = nums ? [...h.faixa, ...h.todos] : h.faixa
  return (
    <header className="chead">
      <ChannelAvatar src={h.avatar} ini={h.ini} color={h.color} className="av" />
      <div className="l1">
        <h1>{h.name}</h1>
        <span className="own-seal">seu canal</span>
        {h.lang ? <abbr className="langtag" title={h.lang.title}>{h.lang.code}</abbr> : null}
        {h.handle ? (
          <a className="handle" href={h.url} target="_blank" rel="noopener noreferrer">{h.handle}<Ext /><span className="obs-ch-sr"> (abre em nova aba)</span></a>
        ) : null}
      </div>
      <div className="acts">
        {compararHref ? (
          <Link className="obs-ch-btn" href={compararHref} title={compararTitulo ?? undefined} data-comparar-canal="" onClick={e => { if (cliqueSimples(e)) lembrarGatilho('canal', h.id) }}>Comparar com…</Link>
        ) : null}
        <a className="obs-ch-btn" href={h.url} target="_blank" rel="noopener noreferrer">Abrir no YouTube<Ext /><span className="obs-ch-sr"> (abre em nova aba)</span></a>
      </div>

      <div className="nrow">
        <div className="nclip">
          <dl className="nstrip" aria-label="Números do canal">{h.faixa.map(c => <Cell key={c.key} c={c} />)}</dl>
        </div>
      </div>

      <div className="lrow">
        <p className="l3"><span>{h.sync}</span></p>
        <div className="ntools">
          <button ref={tipBtn} type="button" className="ibtn" aria-expanded={tip} aria-controls="canal-tip" aria-label="De onde vêm os números do canal" onClick={() => setTip(o => !o)}>
            {Icon.info()}
          </button>
          <button type="button" className="nmore" aria-expanded={nums} aria-controls="canal-nums2" onClick={onToggleNums}>
            Todos os números{Icon.chev()}
          </button>
          <Popover open={tip} anchor={() => tipBtn.current} onClose={() => setTip(false)} id="canal-tip" role="dialog" labelledBy="canal-tip-t" className="canal-tip" pref="baixo" align="fim" maxW={380}>
            <h3 id="canal-tip-t">De onde vêm os números do canal</h3>
            <ul>{cells.map(c => <li key={c.key}><b>{cap(c.label)}:</b> {c.base}</li>)}</ul>
            {nums ? null : <p className="m">Abra “Todos os números” para ver a base dos outros {h.todos.length}.</p>}
          </Popover>
        </div>
      </div>

      {h.posicaoItens ? <div className="prow"><Posicao h={h.posicaoItens} /></div> : null}

      <div className="nclip n2" id="canal-nums2" hidden={!nums}>
        <dl className="nstrip" aria-label="Mais números do canal">{h.todos.map(c => <Cell key={c.key} c={c} />)}</dl>
      </div>
    </header>
  )
}
