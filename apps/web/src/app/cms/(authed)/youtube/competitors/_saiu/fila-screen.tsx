/**
 * A5 · E9, Tarefa 10b: a tela "Saíram do YouTube" (componente CLIENTE: passa funções a BotaoDeResposta, o que um componente de servidor não pode; C-1 do portão 14/10). Só desenha o que `buildFilaView` escreveu; as ações chegam por prop e descem para os
 * componentes cliente também por prop. Cor nunca é o único sinal: cada tipo e cada estado têm ícone e palavra.
 */
'use client'
import type { ReactNode } from 'react'
import CmsLink from '../../../_shared/cms-link'
import { link } from '@/lib/youtube/observatorio/links'
import { BotaoDeResposta, PainelApagar, type AcoesDeResposta, type AcoesDoPainel } from './painel-apagar'
import type { ApagandoView, CartaoView, FilaView, RespondidoView, VoltaView } from './view-model'

export type AcoesDaFila = AcoesDoPainel & AcoesDeResposta

const ICONE: Record<string, string> = { video: '▶', canal: '◉', comentarios: '❝' }
const Cabeca = ({ tipo, rotulo, children }: { tipo: string; rotulo: string; children?: ReactNode }) => (
  <header className="sq-hd"><span className={`sq-k ${tipo}`}><span aria-hidden="true">{ICONE[tipo]}</span><span>{rotulo}</span></span>{children}</header>
)

function Cartao({ c, view, acoes }: { c: CartaoView; view: Extract<FilaView, { estado: 'ok' }>; acoes: AcoesDaFila }) {
  const id = `t-${c.chave}`
  return (
    <article className={`sq-it ${c.tipo}`} aria-labelledby={id}>
      <Cabeca tipo={c.tipo} rotulo={c.rotuloDoTipo}><span className="sq-w">{c.quando}</span></Cabeca>
      <div className="sq-bd">
        <div className="sq-main">
          <h3 id={id}>{c.titulo}</h3>
          <p className="sq-l2">{c.linha2}</p>
          <dl className="sq-f">
            {c.fatos.map(f => (
              <div key={f.rotulo} className={f.largo ? 'sq-w2' : undefined}>
                <dt>{f.rotulo}{f.nota ? <> <small>{f.nota}</small></> : null}</dt><dd>{f.valor}</dd>
              </div>
            ))}
          </dl>
          {c.erroDaPrevia ? <p className="sq-erro-item" role="note">{c.erroDaPrevia}</p> : null}
        </div>
      </div>
      <footer className="sq-ft">
        <BotaoDeResposta rotulo="Manter para análise" destaque desabilitado={!view.podeResponder} titulo={view.semPermissao ?? undefined}
          executar={async () => [await acoes.manter(c.manter)]} />
        {c.painel ? <PainelApagar rotulo={c.apagarRotulo} painel={c.painel} podeResponder={view.podeResponder} semPermissao={view.semPermissao} acoes={acoes} /> : null}
        {view.semPermissao ? <span className="sq-hint">{view.semPermissao}</span> : null}
      </footer>
    </article>
  )
}

function Volta({ v, acoes, pode }: { v: VoltaView; acoes: AcoesDaFila; pode: boolean }) {
  return (
    <article className="sq-it volta">
      <Cabeca tipo={v.tipo} rotulo={v.rotuloDoTipo}><span className="sq-w">{v.quando}</span></Cabeca>
      <div className="sq-bd"><div className="sq-main">
        <h3 className="sq-cod">{v.titulo ?? v.codigo ?? 'comentários'}</h3>
        <p className="sq-l2">{v.texto}</p>
      </div></div>
      {v.acoes.length > 0 ? (
        <footer className="sq-ft">
          {v.acoes.map((a, i) => (
            <BotaoDeResposta key={a.acao} rotulo={a.rotulo} destaque={i === 0} desabilitado={!pode}
              executar={async () => a.acao === 'ignorar_grupo'
                ? [await acoes.ignorarGrupo({ itemIds: a.itemIds })]
                : [await acoes.volta({ itemId: a.itemIds[0]!, decisao: a.acao })]} />
          ))}
          {v.dica ? <span className="sq-hint">{v.dica}</span> : null}
        </footer>
      ) : null}
    </article>
  )
}

function LinhaApagando({ a, acoes, pode }: { a: ApagandoView; acoes: AcoesDaFila; pode: boolean }) {
  return (
    <tr>
      <th scope="row" className="sq-cod">{a.codigo}</th>
      <td>{a.tipo === 'canal' ? 'canal' : a.tipo === 'comentarios' ? 'comentários' : 'vídeo'}</td>
      <td><span className="sq-st apagando"><span aria-hidden="true">◔</span><span>Apagando</span></span></td>
      <td className="sq-num">{a.desde}</td>
      <td><b>{a.falta}</b>{a.voltou ? <> · {a.voltou}</> : null}</td>
      <td>{a.podeTentar ? <BotaoDeResposta rotulo="Tentar de novo" desabilitado={!pode} executar={async () => [await acoes.tentar({ itemId: a.itemId })]} /> : null}</td>
    </tr>
  )
}

function LinhaRespondido({ r }: { r: RespondidoView }) {
  return (
    <tr>
      <th scope="row" className="sq-cod">{r.codigo}{r.titulo ? <><br /><span className="sq-mut">{r.titulo}</span></> : null}</th>
      <td>{r.tipo === 'canal' ? 'canal' : r.tipo === 'comentarios' ? 'comentários' : 'vídeo'}</td>
      <td><span className={`sq-st ${r.situacao === 'mantido' ? 'mant' : 'apag'}`}><span aria-hidden="true">{r.situacao === 'mantido' ? '⚑' : '✕'}</span><span>{r.situacao === 'mantido' ? 'Mantido' : 'Apagado'}</span></span></td>
      <td className="sq-num">{r.quando}</td>
      <td>{r.texto}</td>
    </tr>
  )
}

export function FilaScreen({ view, acoes }: { view: FilaView; acoes: AcoesDaFila }) {
  if (view.estado !== 'ok') {
    return <div className="sq" data-obs-screen="saiu"><p className="sq-erro" role="alert">{view.frase}</p></div>
  }
  const r = view.resumo
  return (
    <div className="sq" data-obs-screen="saiu">
      <div className={`sq-res${r.vazia ? ' vazia' : ''}`}>
        <p className="sq-fr"><b>{r.negrito}</b> {r.texto}</p>
        {r.barra.length > 0 ? (
          <ul className="sq-bar" aria-label="Itens esperando você, por tipo">
            {r.barra.map(b => (
              <li key={b.tipo} className={`sq-sg ${b.tipo}`} style={{ flex: `${b.n} 1 0` }}>
                <span aria-hidden="true">{ICONE[b.tipo]}</span><span className="sq-sgt"><b className="sq-num">{b.n}</b> {b.texto}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {view.manterTodos ? (
          <p className="sq-todos">
            <BotaoDeResposta rotulo={view.manterTodos.rotulo} desabilitado={!view.podeResponder}
              executar={async () => { const rs = []; for (const g of view.manterTodos!.grupos) rs.push(await acoes.manter(g)); return rs }} />
          </p>
        ) : null}
      </div>

      {view.cartoes.length > 0 ? (
        <ol className="sq-ls" aria-label="Itens esperando resposta">
          {view.cartoes.map(c => <li key={c.chave}><Cartao c={c} view={view} acoes={acoes} /></li>)}
        </ol>
      ) : r.vazia ? <p className="sq-vz"><span aria-hidden="true">✓</span><span>Quando um vídeo, um canal ou um comentário sumir do YouTube, ele aparece aqui, com o que você tem guardado e a pergunta: manter ou apagar.</span></p> : null}

      {view.maisN ? <p className="sq-mais"><CmsLink href={link.saiu({ mostrar: view.maisN.mostrar })} className="sq-btn">{`Mostrar mais ${view.maisN.n > 10 ? 10 : view.maisN.n}`}</CmsLink> <span className="sq-hint">{view.maisN.n} ainda na fila</span></p> : null}

      {view.voltaram.length > 0 ? (
        <section className="sq-vl" aria-labelledby="t-vl">
          <h3 id="t-vl" className="sq-vlh">{`Voltaram ao ar (${view.voltaram.length})`}</h3>
          <ol className="sq-ls">{view.voltaram.map(v => <li key={v.chave}><Volta v={v} acoes={acoes} pode={view.podeResponder} /></li>)}</ol>
        </section>
      ) : null}

      {view.apagando.length > 0 ? (
        <section className="sq-ap" aria-labelledby="t-ap">
          <h3 id="t-ap" className="sq-vlh">{`Apagando (${view.apagando.length})`}</h3>
          <p className="sq-l2">Já foram respondidos com "apagar", mas falta apagar parte. O item só conta como concluído quando acabar.</p>
          <div className="sq-tbw"><table className="sq-tab">
            <caption className="sr">Itens sendo apagados: só código e datas</caption>
            <thead><tr><th scope="col">Código no YouTube</th><th scope="col">Tipo</th><th scope="col">Situação</th><th scope="col">Desde</th><th scope="col">O que falta</th><th scope="col"><span className="sr">Ações</span></th></tr></thead>
            <tbody>{view.apagando.map(a => <LinhaApagando key={a.chave} a={a} acoes={acoes} pode={view.podeResponder} />)}</tbody>
          </table></div>
        </section>
      ) : null}

      {view.respondidos.itens.length > 0 ? (
        <details className="sq-rd">
          <summary>{`Já respondidos (${view.respondidos.total})`}</summary>
          <div className="sq-tbw"><table className="sq-tab">
            <caption className="sr">Itens já respondidos: só código e datas</caption>
            <thead><tr><th scope="col">Código no YouTube</th><th scope="col">Tipo</th><th scope="col">Situação</th><th scope="col">Quando</th><th scope="col">Situação do dado</th></tr></thead>
            <tbody>{view.respondidos.itens.map(x => <LinhaRespondido key={x.chave} r={x} />)}</tbody>
          </table></div>
          {view.respondidos.eMais ? <p className="sq-hint">{view.respondidos.eMais}</p> : null}
          <p className="sq-hint">Do que foi apagado ficam só o código e as datas. Nada de título, número ou imagem.</p>
        </details>
      ) : null}

      <details className="sq-aj">
        <summary>Como a fila funciona</summary>
        <ul>{view.ajuda.map(t => <li key={t}>{t}</li>)}</ul>
      </details>
    </div>
  )
}
