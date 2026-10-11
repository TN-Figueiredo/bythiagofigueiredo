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
        {nome ? <><span className="mc-l">Meu canal: </span><b>{nome}</b></> : <b>Meus canais</b>}
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 6l4 4 4-4" /></svg>
      </button>
      <Popover open={aberto} anchor={() => botao.current} onClose={() => setAberto(false)} id="mc-menu" role="menu" labelledBy="mc-menu-t" className="mc-m" pref="baixo" align="fim" gap={4}>
        <div ref={caixa} onKeyDown={aoTeclarMenu} style={{ display: 'contents' }}>
          <p className="mc-h" id="mc-menu-t">Meus canais</p>
          <ul role="none">
            {owns.itens.map(c => (
              <li key={c.id} role="none">
                {c.href ? (
                  <Link role="menuitem" href={c.href} aria-current={atual === c.id ? 'page' : undefined} onClick={() => setAberto(false)}>
                    <b>{c.name}</b><small>{c.nota}</small>
                  </Link>
                ) : (
                  <span role="menuitem" aria-disabled="true" className="off"><b>{c.name}</b><small>{c.nota}</small></span>
                )}
              </li>
            ))}
            <li role="none" className="sep">
              <Link role="menuitem" href={owns.listaHref} onClick={() => setAberto(false)}>Ver meus canais na lista de Canais</Link>
            </li>
          </ul>
        </div>
      </Popover>
    </div>
  )
}
