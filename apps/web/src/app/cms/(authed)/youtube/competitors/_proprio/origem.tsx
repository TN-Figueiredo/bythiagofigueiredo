/**
 * A origem das views na tela (plano E5b, Tarefa 11). Servidor: recebe o `OrigemView` JÁ montado (`buildOrigem`) e só desenha. Nível `so-aviso`
 * recebe apenas o aviso: o modelo nem entrega número nem termo, e aqui nada é buscado. Só `OrigemPeriodos` e `TentarDeNovo` são do cliente.
 */
import type { ReactNode } from 'react'
import type { BlocoView, CelulaFaixaOrigem, GrupoView, LinhaView, OrigemView, SubListaView } from './origem-model'
import { OrigemPeriodos, TentarDeNovo } from './origem-periodos'
import { Glifo } from './origem-glifos'

function Linha({ l }: { l: LinhaView }) {
  const classe = l.tipo === 'omitido' ? 'om' : `o-${l.chave}`
  return (
    <li className={'ov-r' + (l.tipo === 'omitido' ? ' om' : '')} data-chave={l.chave}>
      <span className={'ov-sw ' + classe} aria-hidden="true"><Glifo k={l.chave} /></span>
      <span className="ov-n">{l.rotulo}</span>
      {l.semNumero
        ? <span className="ov-v"><span className="obs-ch-nm" aria-label="sem número informado">{l.valorTexto}</span></span>
        : <span className="ov-v">{l.valorTexto}</span>}
      <span className="ov-p">{l.pctTexto}</span>
    </li>
  )
}

/** Aparelho, país e inscritos: ícone, nome, número e a fatia do total numa trilha (mockup 12). */
function LinhaComTrilha({ l, bloco }: { l: LinhaView; bloco: string }) {
  const omitido = l.tipo === 'omitido'
  const icone = omitido ? 'omitido' : bloco === 'pais' ? 'pais' : l.chave
  return (
    <li className={'ov-hb' + (omitido ? ' om' : '')} data-chave={l.chave}>
      <span className="ov-ic" aria-hidden="true"><Glifo k={icone} /></span>
      <span className="ov-n">{l.rotulo}</span>
      {l.semNumero
        ? <span className="ov-v"><span className="obs-ch-nm" aria-label="sem número informado">{l.valorTexto}</span></span>
        : <span className="ov-v">{l.valorTexto}</span>}
      <span className="ov-p">{l.pctTexto}</span>
      <span className={'ov-tr' + (omitido ? ' om' : '')} aria-hidden="true"><i style={{ width: `${l.semNumero ? 0 : Math.min(Math.max(l.pct, 0), 100)}%` }} /></span>
    </li>
  )
}

function Barra({ linhas, titulo }: { linhas: readonly LinhaView[]; titulo: string }) {
  const comNumero = linhas.filter(l => !l.semNumero && l.valor > 0)
  if (comNumero.length === 0) return null
  const rotulo = `${titulo}: ` + linhas.map(l => l.rotuloLeitor).join('; ')
  return (
    <div className="ov-pil" role="img" aria-label={rotulo}>
      {comNumero.map(l => (
        <span key={l.chave} className={'ov-sg ' + (l.tipo === 'omitido' ? 'om' : `o-${l.chave}`)} style={{ ['--v' as string]: String(Math.max(l.valor, 0)) }}><Glifo k={l.chave} /></span>
      ))}
    </div>
  )
}

function Regua({ b }: { b: BlocoView }) {
  const r = b.regua
  if (r == null || !r.parcial) return null
  const sem = Math.max(r.dias - r.medidos, 0)
  return (
    <div className="ov-cob" role="img" aria-label={r.rotuloLeitor}>
      <div className="ov-trk" aria-hidden="true">
        <span className="ov-nmseg" style={{ flex: `${sem} 1 0%` }} />
        {sem > 60 ? <span className="ov-quebra">//</span> : null}
        <span className="ov-okseg" style={{ flex: `${r.medidos} 1 0%` }} />
      </div>
    </div>
  )
}

function Sub({ s }: { s: SubListaView }) {
  return (
    <div className="ov-ts" data-sublista={s.id}>
      <h4 className="ov-h3">{s.titulo}</h4>
      <p className="ov-fr"><span>{s.frase}</span></p>
      {s.linhas.length > 0 ? <ul className="ov-lg2 tm">{s.linhas.map(l => <li key={l.chave} className="ov-tm"><span className="ov-n">{l.rotulo}</span><span className="ov-v">{l.valorTexto}</span></li>)}</ul> : null}
      {s.comparacao ? <p className="ov-lem">{s.comparacao}</p> : null}
    </div>
  )
}

function Bloco({ b }: { b: BlocoView }) {
  return (
    <section className="ov-sec ov-card" data-bloco={b.id} data-estado={b.estado}>
      <h3 className="ov-h3">{b.id === 'termos' ? <svg className="ov-g ov-priv-i" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><rect x="3" y="7" width="10" height="7" rx="1.5" /><path d="M5 7V5a3 3 0 0 1 6 0v2" /></svg> : null}{b.titulo}</h3>
      {b.erro != null ? (
        <div className="ov-er" role="alert">
          <span className="ov-er-i" aria-hidden="true"><Glifo k="aviso" /></span>
          <div><p>{b.erro}</p><p className="ov-er-b"><TentarDeNovo /></p></div>
        </div>
      ) : (
        <>
          {/* cada estado sem número tem a sua forma, além da cor: hachura (não medido), caixa vazada (zero), pontilhado (ainda não existe), cadeado e aviso (sem acesso, revisão) */}
          {b.estado === 'nao_medido' ? <div className="ov-hach" aria-hidden="true" /> : null}
          {b.estado === 'zero' ? <div className="ov-zero-w"><div className="ov-zero" aria-hidden="true"><b>0</b></div></div> : null}
          {b.estado === 'ainda_nao_existe' && b.frase
            ? <div className="ov-vz"><span className="ov-vz-i" aria-hidden="true"><Glifo k="relogio" /></span><p>{b.frase}</p></div>
            : b.frase ? <p className="ov-fr"><span>{b.frase}</span></p> : null}
          {b.aviso && b.estado === 'em_revisao'
            ? <div className="ov-bq"><span className="ov-bq-i" aria-hidden="true"><Glifo k="aviso" /></span><p>{b.aviso}</p></div>
            : b.aviso ? <p className="ov-lem">{b.aviso}</p> : null}
          {b.bloqueio ? <div className="ov-bq"><span className="ov-bq-i" aria-hidden="true"><Glifo k="lock" /></span><p>{b.bloqueio}</p></div> : null}
          {b.id === 'origem' ? <Barra linhas={b.linhas} titulo={b.titulo} /> : null}
          {b.linhas.length > 0 && (b.id === 'aparelho' || b.id === 'pais' || b.id === 'inscritos')
            ? <ul className="ov-lg2">{b.linhas.map(l => <LinhaComTrilha key={l.chave} l={l} bloco={b.id} />)}</ul>
            : b.linhas.length > 0 ? <ul className="ov-lg">{b.linhas.map(l => <Linha key={l.chave} l={l} />)}</ul> : null}
          {b.subListas?.map(s => <Sub key={s.id} s={s} />)}
          {b.linhasDeContagem.map(t => <p key={t} className="ov-vtot">{t}</p>)}
          {b.cobertura ? <p className="ov-cb">{b.cobertura}</p> : null}
          <Regua b={b} />
          {b.rodape ? <p className="ov-lem">{b.rodape}</p> : null}
        </>
      )}
    </section>
  )
}

/** A faixa de duas células do topo da aba Origem do canal (T17): o total do período e os dias com origem medida. */
function Faixa({ celulas }: { celulas: readonly CelulaFaixaOrigem[] }) {
  return (
    <dl className={'ov-fx' + (celulas.length === 1 ? ' um' : '')} aria-label="Números do período">
      {celulas.map(c => (
        <div key={c.rotulo} className="ov-fx-c">
          <dt>{c.rotulo}</dt>
          {/* "não medido" e "—" têm a forma do kit (chip rosa tracejado), nunca texto solto */}
          <dd>{c.valor === 'não medido' || c.valor === '—' ? <span className="obs-ch-nm" aria-label="não medido">{c.valor}</span> : <b className="num">{c.valor}</b>}<span>{c.sub}</span></dd>
        </div>
      ))}
    </dl>
  )
}

function Grupo({ g }: { g: GrupoView }): ReactNode {
  return (
    <div className="ov-grupo">
      {g.faixa ? <Faixa celulas={[g.faixa.views, g.faixa.dias]} /> : g.views ? <Faixa celulas={[g.views]} /> : <p className="ov-vtot">{g.total}</p>}
      {g.blocos.map(b => <Bloco key={b.id} b={b} />)}
    </div>
  )
}

export function Origem({ view }: { view: OrigemView }) {
  if (view.semAcesso != null) {
    return (
      <section className="ov-novo ov-sem-acesso" aria-label={view.semAcesso.titulo}>
        <h3 className="ov-h3">{view.semAcesso.titulo}</h3>
        {view.semAcesso.frases.map(f => <p key={f} className="ov-fr"><span>{f}</span></p>)}
      </section>
    )
  }
  const conteudos: Record<string, ReactNode> = Object.fromEntries(view.periodos.map(p => [p.id, <Grupo key={p.id} g={p.grupo} />]))
  return <OrigemPeriodos opcoes={view.periodos.map(p => ({ id: p.id, rotulo: p.rotulo }))} conteudos={conteudos} padrao={view.padrao} lembranca={view.lembranca} dica={view.dica} />
}
