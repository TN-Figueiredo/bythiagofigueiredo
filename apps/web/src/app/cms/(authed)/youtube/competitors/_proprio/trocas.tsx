/**
 * Trocas deste vídeo (T22b; mockup 3b): a linha de cima ("Trocas deste vídeo: ...") sobre o gráfico de views e o bloco depois de "Impressões e cliques".
 * Componente de SERVIDOR: recebe o `TrocasView` JÁ montado (`buildTrocas`, só texto e frações), sem banco. `diagnostico` nunca entra aqui.
 * Estado nunca é só cor: todo chip leva símbolo E texto; lado sem número tem forma própria de borda (cheia, tracejada, pontilhada, dupla, dupla tracejada).
 */
import { InfoDica } from './info-dica'
import { rotuloChip, simboloDoChip, type Chip, type LadoView, type TesteView, type TrocaView, type TrocasView } from './trocas-model'
import './trocas.css'

function ChipTroca({ chip }: { chip: Chip }) {
  return <span className={'tr-chip tr-chip-' + chip} data-chip={chip}><span aria-hidden="true">{simboloDoChip(chip)}</span> {rotuloChip(chip).replace(/^\S+\s/, '')}</span>
}

export function LinhaDasTrocas({ view }: { view: TrocasView }) {
  if (view.estado === 'privado') return null
  return (
    <div className="tr-linha">
      <p className="tr-topo">
        {view.topo.partes.map((p, i) => (p.b ? <b key={i}>{p.t}</b> : <span key={i}>{p.t}</span>))}
        {view.topo.aviso ? <span className="tr-aviso"> {view.topo.aviso}</span> : null}
      </p>
      {view.contagens.length ? (
        <ul className="tr-contagens" aria-label="Trocas por resultado">
          {view.contagens.map(c => <li key={c.chip}><ChipTroca chip={c.chip} /> <span className="tr-cont-n">{c.n}</span></li>)}
        </ul>
      ) : null}
    </div>
  )
}

function Lado({ l }: { l: LadoView }) {
  return (
    <div className={'tr-lado tr-lado-' + l.forma} role="group" aria-label={l.aria}>
      <span className="tr-lado-rot">{l.rotulo}</span>
      {l.taxa ? <b className="tr-lado-taxa">{l.taxa}</b> : null}
      {l.faixa ? <span className="tr-lado-faixa">{l.faixa}</span> : null}
      {l.barra ? (
        <span className="tr-trilho" aria-hidden="true">
          <span className="tr-int" style={{ left: `${l.barra.lo * 100}%`, width: `${Math.max((l.barra.hi - l.barra.lo) * 100, 0.6)}%` }} />
          <span className="tr-pt" style={{ left: `${l.barra.taxa * 100}%` }} />
        </span>
      ) : null}
      {l.causa ? <span className="tr-lado-causa">{l.causa}</span> : null}
    </div>
  )
}

function Imagem({ t }: { t: TrocaView['de'] }) {
  if (t.texto != null) return <span className="tr-txt">{t.texto}</span>
  return <span className="tr-img-nota">{t.notaImagem ?? 'Miniatura'}</span>
}

function LinhaTeste({ v }: { v: TesteView }) {
  return (
    <li className="tr-item tr-teste">
      <div className="tr-item-cab"><b>{v.titulo}</b> <span className="tr-quando">{v.quando}</span> <span className="tr-ciclos">{v.nCiclos}</span></div>
      <p>{v.frase}</p>
      {v.teste === 'sem-acesso'
        ? <span className="tr-sem-acesso">Teste A/B (sem acesso)</span>
        : <a className="tr-link" href={v.teste.href}>Abrir o teste A/B</a>}
    </li>
  )
}

function ItemTroca({ v }: { v: TrocaView }) {
  return (
    <li className="tr-item tr-troca" data-chip={v.chip}>
      <div className="tr-item-cab">
        <span className="tr-n">{v.n}</span> <b>{v.campo === 'title' ? 'Título' : 'Miniatura'}</b> <span className="tr-quando">{v.quando}</span> <ChipTroca chip={v.chip} />
      </div>
      <p className="tr-de-para"><Imagem t={v.de} /> <span aria-hidden="true">→</span> <Imagem t={v.para} /></p>
      <p className="tr-origem"><span className="tr-origem-chip">{v.origem.chip}</span> {v.origem.frase}
        {v.origem.teste === 'sem-acesso' ? <span className="tr-sem-acesso"> Teste A/B (sem acesso)</span>
          : v.origem.teste ? <> <a className="tr-link" href={v.origem.teste.href}>Abrir o teste A/B</a></> : null}
      </p>
      <p className="tr-frase">{v.frase}</p>
      {v.antes || v.depois ? <div className="tr-lados">{v.antes ? <Lado l={v.antes} /> : null}{v.depois ? <Lado l={v.depois} /> : null}</div> : null}
      {v.notas.map((n, i) => <p key={i} className="tr-nota">{n}</p>)}
    </li>
  )
}

export function Trocas({ view }: { view: TrocasView }) {
  return (
    <section className="vb-sec tr-sec" aria-labelledby="tr-h">
      <div className="vb-h"><h2 id="tr-h">Trocas deste vídeo</h2><InfoDica titulo="Como as trocas são lidas" paragrafos={view.metodo} /></div>
      {view.estado === 'privado' || view.bloqueio ? (
        <div className="tr-bloqueio" role="note">{(view.bloqueio ?? [view.frase]).map((l, i) => <p key={i}>{l}</p>)}</div>
      ) : (
        <>
          <p className="tr-resumo"><span>{view.frase}</span></p>
          {view.atraso ? <div className="tr-atraso" role="alert">{view.atraso.linhas.map((l, i) => <p key={i}>{l}</p>)}</div> : null}
          {view.regua ? (
            <div className="tr-regua" role="img" aria-label={view.regua.aria}>
              <span className="tr-regua-ext">{view.regua.rotuloDe}</span><span className="tr-regua-ext">{view.regua.rotuloAte}</span>
            </div>
          ) : null}
          {view.avisos.map((a, i) => <p key={i} className="tr-aviso">{a}</p>)}
          {view.reconstruida ? (
            <div className="tr-reconstruida">
              <h3>{view.reconstruida.titulo}</h3>
              <p>{view.reconstruida.frase}</p>
              <ul>{view.reconstruida.linhas.map((l, i) => <li key={i}>{l}</li>)}</ul>
              {view.reconstruida.selos.length ? <p className="tr-selos">{view.reconstruida.selos.join(' · ')}</p> : null}
              <p className="tr-divisor">{view.reconstruida.divisor}</p>
            </div>
          ) : null}
          {view.zero ? <div className="tr-vazio">0 trocas registradas.</div> : (
            <ol className="tr-lista">
              {view.itens.map(it => (it.tipo === 'teste' ? <LinhaTeste key={'t' + it.v.id} v={it.v} /> : <ItemTroca key={'c' + it.v.n} v={it.v} />))}
            </ol>
          )}
        </>
      )}
    </section>
  )
}
