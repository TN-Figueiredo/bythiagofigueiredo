'use client'
/**
 * O atalho "Meu canal: <nome>" (spec 15.2, mockup meu-canal.js): um botão que abre um menu com os canais próprios do site. Mora no grupo de ações do
 * cabeçalho do Observatório (ao lado de "Adicionar canal") e na linha da trilha das páginas de canal, de vídeo e de comparação, à direita.
 *
 * O menu é um Popover da camada única (#flut): Esc fecha e devolve o foco ao botão, setas/Home/End andam pelos itens, o primeiro recebe o foco ao
 * abrir. O canal sem vídeos não tem página (16.8): aparece apagado ("ainda sem página"), não é link e fica fora das setas. Os destinos vêm prontos em
 * `owns` (montados por `ownChannelHref` e `link.canais`): o componente não monta rota nenhuma. O `Link` é importado aqui, no módulo cliente: nenhum
 * Server Component entrega um Link como prop (Next 16).
 */
import Link from 'next/link'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Popover } from './flut/flut'
import { Icon } from './icons'
import { lembrarMeuCanal } from './meu-canal-lembrado'
import type { OwnMenu } from './own-menu'
import './meu-canal.css'

/** Sem canal próprio o componente não existe. */
export function MeuCanal({ owns, atual }: { owns: OwnMenu; atual?: string }) {
  if (!owns.itens.length) return null
  return <Atalho owns={owns} atual={atual} />
}

function Atalho({ owns, atual }: { owns: OwnMenu; atual?: string }) {
  const [aberto, setAberto] = useState(false)
  const botao = useRef<HTMLButtonElement>(null), caixa = useRef<HTMLDivElement>(null)
  const itens = () => [...(caixa.current?.querySelectorAll<HTMLElement>('a[role="menuitem"]') ?? [])]
  const [onde, setOnde] = useState<'first' | 'last'>('first')
  useEffect(() => {
    if (!aberto) return
    const xs = itens()
    ;(onde === 'last' ? xs[xs.length - 1] : xs[0])?.focus({ preventScroll: true })
  }, [aberto, onde])
  const nome = owns.principal?.name ?? null
  const aoTeclarBotao = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setOnde(e.key === 'ArrowDown' ? 'first' : 'last'); setAberto(true) }
  }
  const aoTeclarMenu = (e: KeyboardEvent) => {
    const xs = itens(), i = xs.indexOf(document.activeElement as HTMLElement)
    const ir = (j: number) => { e.preventDefault(); xs[(j + xs.length) % xs.length]?.focus() }
    if (e.key === 'ArrowDown') ir(i + 1)
    else if (e.key === 'ArrowUp') ir(i - 1)
    else if (e.key === 'Home') ir(0)
    else if (e.key === 'End') ir(xs.length - 1)
    // Tab / Shift+Tab: a camada flutuante costura o menu de volta ao botão (flut/store.ts)
  }
  return (
    <div className="mc" data-meu-canal="">
      <button ref={botao} type="button" className="mc-b" aria-haspopup="menu" aria-expanded={aberto} aria-controls={aberto ? 'mc-menu' : undefined}
        onClick={() => { setOnde('first'); setAberto(o => !o) }} onKeyDown={aoTeclarBotao}>
        <svg className="mc-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></svg>
        {nome ? <><span className="mc-l">Meu canal: </span><b title={nome}>{nome}</b></> : <b>Meus canais</b>}
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 6l4 4 4-4" /></svg>
      </button>
      <Popover open={aberto} anchor={() => botao.current} onClose={() => setAberto(false)} id="mc-menu" role="menu" labelledBy="mc-menu-t" className="mc-m" pref="baixo" align="fim" gap={4}>
        <div ref={caixa} onKeyDown={aoTeclarMenu} style={{ display: 'contents' }}>
          <ItensMeuCanal owns={owns} atual={atual} aoEscolher={() => setAberto(false)} idTitulo="mc-menu-t" />
        </div>
      </Popover>
    </div>
  )
}

/**
 * O miolo do menu "Meus canais": o cabeçalho, a dica, os itens e "Ver meus canais na lista de Canais". Os dois menus o usam (o do atalho e, em
 * janela estreita, o ⋯ das abas). Clicar num item abre o canal E o torna "o meu canal" (cookie, D-C.2): só num gesto do dono, nunca ao abrir.
 * Com dois ou mais canais com vídeos o principal leva um ✓ (com texto para leitor de tela) e uma dica diz o que o ✓ significa e como trocar.
 */
export function ItensMeuCanal({ owns, atual, aoEscolher, idTitulo }: { owns: OwnMenu; atual?: string; aoEscolher: () => void; idTitulo?: string }) {
  const varios = owns.itens.filter(c => c.href != null).length >= 2
  return (
    <>
      <p className="mc-h" id={idTitulo}>Meus canais</p>
      {varios ? <p className="mc-dica">Comparar com o meu canal usa o canal com ✓. Para trocar, abra outro daqui.</p> : null}
      <ul role="none">
        {owns.itens.map(c => (
          <li key={c.id} role="none">
            {c.href ? (
              <Link role="menuitem" href={c.href} aria-current={atual === c.id ? 'page' : undefined} onClick={() => { lembrarMeuCanal(c.id); aoEscolher() }}>
                <span className="mc-n"><b>{c.name}</b>{varios && owns.principal?.id === c.id ? <><span className="mc-ok" aria-hidden="true">{Icon.check()}</span><span className="mc-sr"> (usado em Comparar com o meu canal)</span></> : null}</span>
                <small>{c.nota}</small>
              </Link>
            ) : (
              <span role="menuitem" aria-disabled="true" className="off"><span className="mc-n"><b>{c.name}</b></span><small>{c.nota}</small></span>
            )}
          </li>
        ))}
        <li role="none" className="sep">
          <Link role="menuitem" href={owns.listaHref} onClick={aoEscolher}>Ver meus canais na lista de Canais</Link>
        </li>
      </ul>
    </>
  )
}
