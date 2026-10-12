/**
 * Os blocos da tela do VÍDEO próprio (A4 13.4), na ordem aprovada: Views por dia, Impressões e cliques (com a taxa de clique), Quanto do vídeo as
 * pessoas assistem, Retenção, Este vídeo no canal, o cartão da forja e "O que ainda não há deste vídeo". Componente de SERVIDOR: recebe o modelo JÁ
 * montado (`buildVideoBlocos`, só texto e frações) e o repassa aos filhos; o gráfico e as réguas são componentes cliente que recebem só o que
 * esta tela já mostra. Quem só lê o site recebe `acesso: 'negado'`: nenhum bloco privado existe no modelo, e aqui só aparece a nota única.
 */
import { Impressoes } from './impressoes'
import { InfoDica } from './info-dica'
import { ForjaIndisponivelVideo } from './forja-indisponivel-video'
import { Reguas } from './reguas'
import { TaxaFaixa } from './taxa-faixa'
import type { BlocoAssistido, BlocoImpressoes, BlocoRetencao, BlocoTaxa, BlocoViews, DirecaoAssistido, Parte, VideoBlocosView } from './video-blocos-model'
import './video-blocos.css'

const SIMBOLO: Record<DirecaoAssistido, string> = { acima: '▲', 'na-media': '＝', abaixo: '▼' }

function NaoMedido({ frase }: { frase: string }) {
  return <div className="vb-nml"><span className="obs-ch-nm">não medido</span><p>{frase}</p></div>
}

const Partes = ({ partes, pouco }: { partes: readonly Parte[]; pouco?: boolean }) => (
  <>{partes.map((p, i) => (p.b ? <b key={i} className={pouco ? 'vb-num-pouco' : undefined}>{p.t}</b> : <span key={i}>{p.t}</span>))}</>
)

function SecViews({ b }: { b: BlocoViews }) {
  return (
    <section className="vb-sec" aria-labelledby="vb-views-h">
      <h2 id="vb-views-h">Views por dia</h2>
      {b.grafico ? <Impressoes view={b.grafico} titulo="Views do vídeo, dia a dia" /> : <NaoMedido frase={b.frase} />}
    </section>
  )
}

function Taxa({ t }: { t: BlocoTaxa }) {
  return (
    <div className="vb-ctr">
      <h3>Taxa de clique deste vídeo <InfoDica titulo="Como a taxa é calculada" paragrafos={t.metodo} /></h3>
      <p className="vb-fr"><Partes partes={t.partes} /></p>
      <TaxaFaixa view={t.faixa} />
    </div>
  )
}

function SecImpressoes({ b }: { b: BlocoImpressoes }) {
  return (
    <section className="vb-sec" aria-labelledby="vb-imp-h">
      <h2 id="vb-imp-h">Impressões e cliques</h2>
      {b.grafico ? <Impressoes view={b.grafico} titulo="Impressões e cliques por dia" /> : null}
      {b.frase ? <NaoMedido frase={b.frase} /> : null}
      {b.taxa ? <Taxa t={b.taxa} /> : null}
      {b.semTaxa ? <NaoMedido frase={b.semTaxa} /> : null}
    </section>
  )
}

function SecAssistido({ a }: { a: BlocoAssistido }) {
  const pouco = a.estado === 'pouco'
  return (
    <section className="vb-sec" aria-labelledby="vb-as-h">
      <h2 id="vb-as-h">Quanto do vídeo as pessoas assistem <InfoDica titulo="De onde vem o % assistido" paragrafos={a.metodo} /></h2>
      {a.estado === 'nao-medido' ? <NaoMedido frase={a.partes.map(p => p.t).join('')} /> : (
        <div className="vb-as">
          <p className="vb-fr"><Partes partes={a.partes} pouco={pouco} /></p>
          <div className={'vb-as-barra' + (pouco ? ' pouco' : '')} role="img" aria-label={a.alt}>
            <i style={{ width: `${a.barraPct}%` }} />
            {a.marcaPct != null ? <s style={{ left: `${a.marcaPct}%` }} /> : null}
          </div>
          {a.marcas ? <div className="vb-as-tk" aria-hidden="true"><span>{a.marcas[0]}</span><span>{a.marcas[1]}</span><span>{a.marcas[2]}</span></div> : null}
          {a.marcaPct != null ? <div className="vb-as-med" aria-hidden="true"><span style={{ left: `${a.marcaPct}%` }}>normal do canal: {a.normalTexto}</span></div> : null}
          {a.contra && a.direcao ? <p className={'vb-nt vb-dir-' + a.direcao}><span aria-hidden="true">{SIMBOLO[a.direcao]}</span> {a.contra}</p> : null}
          {a.semNormal ? <p className="vb-nt">{a.semNormal}</p> : null}
        </div>
      )}
    </section>
  )
}

function SecRetencao({ r }: { r: BlocoRetencao }) {
  const [primeira, ...resto] = r.frase.split('. ')
  return (
    <section className="vb-sec" aria-labelledby="vb-ret-h">
      <h2 id="vb-ret-h">Retenção <InfoDica titulo="De onde vem a curva" paragrafos={r.metodo} /></h2>
      <div className="vb-nml"><span className="obs-ch-nm">não medido</span><p><b>{primeira}.</b> {resto.join('. ')}</p></div>
    </section>
  )
}

export function VideoBlocos({ view }: { view: VideoBlocosView }) {
  return (
    <>
      {view.acesso === 'ok' && view.views ? <SecViews b={view.views} /> : null}
      {view.acesso === 'ok' && view.impressoes ? <SecImpressoes b={view.impressoes} /> : null}
      {view.acesso === 'ok' && view.assistido ? <SecAssistido a={view.assistido} /> : null}
      {view.nota ? <p className="vb-privado" data-privado-nota="">{view.nota}</p> : null}
      <SecRetencao r={view.retencao} />
      <section className="vb-sec" aria-labelledby="vb-canal-h">
        <h2 id="vb-canal-h">Este vídeo no canal</h2>
        <Reguas view={view.canal.reguas} />
        {view.canal.notaDiario ? (view.acesso === 'ok' ? <NaoMedido frase={view.canal.notaDiario} /> : <p className="vb-nt">{view.canal.notaDiario}</p>) : null}
      </section>
      <ForjaIndisponivelVideo view={view.forja} />
      <section className="vb-sec" aria-labelledby="vb-ainda-h">
        <h2 id="vb-ainda-h">O que ainda não há deste vídeo</h2>
        <p className="vb-ainda">{view.ainda}</p>
      </section>
    </>
  )
}
