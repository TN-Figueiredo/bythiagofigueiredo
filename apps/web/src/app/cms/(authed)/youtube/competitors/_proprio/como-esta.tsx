'use client'
/**
 * A seção "Como o canal está" (spec 16.5; mockup M/canal.js `painel()` e canal.css, rodada 7): acima das abas, RECOLHIDA por padrão. Recolhida é uma
 * linha (o alcance e a posição em inscritos); aberta traz a frase do topo, o gráfico "Impressões por dia", "Vídeos que mais apareceram", "No nicho" (as
 * posições e o formulário "Comparar com…") e "O que ainda não é medido". Recebe tudo JÁ montado pelo modelo: não lê banco, não importa os leitores.
 *
 * Estado: nasce da URL (`?painel=1` abre, `?painel=0` fecha) e, sem ela, do que a pessoa deixou em `localStorage` (`obs:como-esta:<canalId>`, sempre em
 * try/catch: sem ele a tela fica no padrão). Next 16 não remonta o componente quando só a query muda: o estado é ressincronizado POR VALOR do `painel`
 * que o servidor manda. O servidor e o primeiro render do cliente concordam (recolhida, ou aberta só por `?painel=1`); a lembrança entra depois, em
 * layout effect. O formulário é GET de verdade (select e botão, duas paradas de Tab) e mudar o select NÃO envia (a seta num select fechado dispara
 * `change` em alguns navegadores). O `Link` é importado aqui, no módulo cliente: nenhum Link chega por prop.
 */
import Link from 'next/link'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '../_chrome/icons'
import type { ComoEstaView } from './como-esta-model'
import { Impressoes } from './impressoes'
import type { ImpressoesView } from './impressoes-model'

const TITULO_GRAFICO = 'Impressões por dia do canal'
const chaveDe = (canalId: string): string => 'obs:como-esta:' + canalId

/** O que a pessoa deixou. Sem `localStorage` (bloqueado, modo privado, servidor): recolhida. */
function lembrada(canalId: string): boolean {
  try { return window.localStorage.getItem(chaveDe(canalId)) === '1' } catch { return false }
}

function decidir(painel: '1' | '0' | null, canalId: string): boolean {
  return painel === '1' ? true : painel === '0' ? false : lembrada(canalId)
}

/** Espelha a escolha na URL atual sem navegar (o resto da URL passa intacto). A URL é conforto: se o navegador recusar, a tela já mudou. */
function escreverPainel(aberto: boolean): void {
  try {
    const q = new URLSearchParams(window.location.search)
    q.set('painel', aberto ? '1' : '0')
    window.history.replaceState(null, '', window.location.pathname + '?' + q.toString() + window.location.hash)
  } catch { /* a URL é conforto */ }
}

/** "Entre 14 canais de Viagem: a, b, c. d." — os três primeiros separados por vírgula e o último em outra frase, como na linha do cabeçalho. */
function Posicoes({ n }: { n: NonNullable<ComoEstaView['noNicho']> }) {
  const item = (l: { texto: string; href: string | null }) => (l.href ? <Link href={l.href} prefetch={false}>{l.texto}</Link> : <>{l.texto}</>)
  const ultimo = n.linhas.length > 1 ? n.linhas[n.linhas.length - 1]! : null
  const antes = ultimo ? n.linhas.slice(0, -1) : n.linhas
  return (
    <p className="pos">
      {n.intro}{' '}
      {antes.map((l, i) => <span key={l.texto}>{item(l)}{i < antes.length - 1 ? ', ' : ultimo ? '. ' : '.'}</span>)}
      {ultimo ? <>{item(ultimo)}.</> : null}
    </p>
  )
}

function Formulario({ n, canalId }: { n: NonNullable<ComoEstaView['noNicho']>; canalId: string }) {
  const selId = useId()
  if (n.opcoes.length === 0) return null
  return (
    <form className="cmpf" action={n.acao} method="get">
      <input type="hidden" name="a" value={canalId} />
      <span className="cmpsel">
        <label className="obs-ch-sr" htmlFor={selId}>Comparar o seu canal com um concorrente</label>
        <select id={selId} name="b" defaultValue={n.opcoes[0]!.id}>
          {n.opcoes.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        {Icon.chev()}
      </span>
      <button type="submit" className="obs-ch-btn">Comparar</button>
    </form>
  )
}

function Corpo({ view, grafico, canalId }: { view: ComoEstaView; grafico: ImpressoesView; canalId: string }) {
  const topId = useId()
  const n = view.noNicho
  return (
    <>
      {/* sem o que desenhar o gráfico já diz a mesma frase: ela não se repete três vezes (linha recolhida, topo e gráfico) */}
      {view.frase !== grafico.vazio ? <p className="pn-lead">{view.frase}</p> : null}
      <div className="pn-g">
        <div className="pn-c"><Impressoes view={grafico} titulo={TITULO_GRAFICO} /></div>
        <div className="pn-s">
          <h3 id={topId}>Vídeos que mais apareceram</h3>
          {view.top.length ? (
            <ol className="pn-top" role="list" aria-labelledby={topId}>
              {view.top.map(t => (
                <li key={t.id}>
                  <Link href={t.href} prefetch={false}>
                    {t.thumb ? <img src={t.thumb} alt="" width={64} height={36} loading="lazy" decoding="async" /> : <span className="pn-ph" aria-hidden="true" />}
                    <span><b>{t.titulo}</b><small>{t.imp}, {t.cliques}, {t.dias}</small></span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : <p className="pn-vazio">{view.topVazio}</p>}
          {view.topNota ? <p className="pn-nota">{view.topNota}</p> : null}
        </div>
      </div>
      <div className="pn-g two">
        {n ? (
          <div>
            <h3>No nicho</h3>
            <Posicoes n={n} />
            <div className="pn-cmp">
              <Formulario n={n} canalId={canalId} />
              <Link className="lk" href={n.listaHref} prefetch={false}>Ver a lista de Canais</Link>
            </div>
          </div>
        ) : null}
        <div>
          <h3>O que ainda não é medido</h3>
          <dl className="pn-nm">
            {view.naoMedido.map(x => <div key={x.rotulo}><dt>{x.rotulo}</dt><dd>{x.texto}</dd></div>)}
          </dl>
        </div>
      </div>
    </>
  )
}

export function ComoEsta({ view, grafico, painel, canalId }: {
  view: ComoEstaView
  grafico: ImpressoesView
  /** O que a URL diz: '1' abre, '0' fecha, ausente = o que a pessoa deixou (ou recolhida). */
  painel: '1' | '0' | null
  canalId: string
}) {
  const hId = useId(), bId = useId()
  const [aberto, setAberto] = useState(painel === '1')
  // Ressincroniza POR VALOR quando o servidor manda outro `painel` (Next 16 não remonta quando só a query muda). Na primeira passada lê a lembrança
  // (só existe no navegador), antes da primeira pintura.
  const visto = useRef<string | null>(null)
  useLayoutEffect(() => {
    const k = `${canalId}|${painel ?? ''}`
    if (visto.current === k) return
    visto.current = k
    setAberto(decidir(painel, canalId))
  }, [painel, canalId])

  const alternar = () => {
    const novo = !aberto
    setAberto(novo)
    try { window.localStorage.setItem(chaveDe(canalId), novo ? '1' : '0') } catch { /* sem armazenamento a tela fica no padrão */ }
    escreverPainel(novo)
  }

  return (
    <section className="pn" aria-labelledby={hId}>
      <div className="pn-h">
        <h2 id={hId}>
          <button type="button" aria-expanded={aberto} aria-controls={bId} onClick={alternar}>Como o canal está{Icon.chev()}</button>
        </h2>
        <p className="pn-r">{view.recolhida}</p>
      </div>
      <div className="pn-b" id={bId} hidden={!aberto}>
        {aberto ? <Corpo view={view} grafico={grafico} canalId={canalId} /> : null}
      </div>
    </section>
  )
}
