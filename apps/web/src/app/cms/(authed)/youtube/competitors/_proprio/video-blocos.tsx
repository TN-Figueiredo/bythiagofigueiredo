/**
 * Os blocos da tela do VÍDEO próprio (A4 13.4), na ordem aprovada: Views por dia, Impressões e cliques (com a taxa de clique), Quanto do vídeo as
 * pessoas assistem, Retenção, Este vídeo no canal, o cartão da forja e "O que ainda não há deste vídeo". Componente de SERVIDOR: recebe o modelo JÁ
 * montado (`buildVideoBlocos`, só texto e frações) e o repassa aos filhos; o gráfico e as réguas são componentes cliente que recebem só o que
 * esta tela já mostra. Quem só lê o site recebe `acesso: 'negado'`: nenhum bloco privado existe no modelo, e aqui só aparece a nota única.
 */
import type { ReactNode } from 'react'
import { BarraAssistido } from './barra-assistido'
import { Impressoes } from './impressoes'
import { InfoDica } from './info-dica'
import { ForjaIndisponivelVideo } from './forja-indisponivel-video'
import { Reguas } from './reguas'
import { RetencaoCurva } from './retencao-curva'
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
      <div className="vb-h"><h3>Taxa de clique deste vídeo</h3><InfoDica titulo="Como a taxa é calculada" paragrafos={t.metodo} /></div>
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

/** O estado "Carregando" dos cartões de período (fallback do `Suspense` de `AssistidoDoVideo`): três caixas lisas, sem número. */
export function AssistidoEsqueleto({ barra }: { barra?: BlocoAssistido | null }) {
  return (
    <div className="vb-ap-esq" role="status" aria-busy="true">
      {barra ? <BarraAssistido a={barra} normal={null} /> : null}
      <div className="vb-ap-cs" aria-hidden="true"><i /><i /><i /></div>
      <p className="vb-nt">Carregando o % assistido por período…</p>
    </div>
  )
}

function SecAssistido({ a, periodos }: { a: BlocoAssistido; periodos?: ReactNode }) {
  const pouco = a.estado === 'pouco'
  return (
    <section className="vb-sec" aria-labelledby="vb-as-h">
      <div className="vb-h"><h2 id="vb-as-h">Quanto do vídeo as pessoas assistem</h2><InfoDica titulo="De onde vem o % assistido" paragrafos={a.metodo} /></div>
      {a.estado === 'nao-medido' ? <NaoMedido frase={a.partes.map(p => p.t).join('')} /> : (
        <div className="vb-as">
          <p className="vb-fr"><Partes partes={a.partes} pouco={pouco} /></p>
          {/* com os cartões de período, a barra, a marca e a comparação são deles (`AssistidoPeriodos`): o "normal" segue o período escolhido, nunca fica um segundo, de 28 dias, ao lado */}
          {periodos ? null : (
            <>
              <BarraAssistido a={a} rotuloPeriodo="canal inteiro" />
              {a.contra && a.direcao ? <p className={'vb-nt vb-dir-' + a.direcao}><span aria-hidden="true">{SIMBOLO[a.direcao]}</span> {a.contra}</p> : null}
              {a.semNormal ? <p className="vb-nt">{a.semNormal}</p> : null}
            </>
          )}
        </div>
      )}
      {periodos}
    </section>
  )
}

/** A seção "Retenção" (A5 E8, Tarefa 13): cinco estados, e o gráfico só no `coletada`. Os outros quatro dizem a frase do estado; a pastilha é por estado (`rotulo`): "não medido", "falhou" ou nenhuma. */
function SecRetencao({ r }: { r: BlocoRetencao }) {
  // a primeira frase em negrito, como era; uma frase só (erro, negado) vai inteira, sem ponto duplicado
  const [primeira, ...resto] = r.frase.split('. ')
  return (
    <section className="vb-sec" aria-labelledby="vb-ret-h">
      <div className="vb-h"><h2 id="vb-ret-h">Retenção</h2><InfoDica titulo="De onde vem a curva" paragrafos={r.metodo} /></div>
      {r.estado === 'coletada' && r.curva ? (
        <>
          <p className="vb-fr"><Partes partes={r.partes} /></p>
          <RetencaoCurva curva={r.curva} />
          {r.saidas || r.revistos ? (
            <ul className="vb-ret-ls">
              {r.saidas ? <li><b>Maiores saídas:</b>{r.saidas.slice('Maiores saídas:'.length)}</li> : null}
              {r.revistos ? <li><b>Trechos revistos:</b>{r.revistos.slice('Trechos revistos:'.length)}</li> : null}
            </ul>
          ) : null}
          {r.aviso ? <p className="vb-ret-aviso">{r.aviso}</p> : null}
        </>
      ) : (
        <div className="vb-nml">
          {r.rotulo ? <span className={r.rotulo === 'falhou' ? 'vb-falhou' : 'obs-ch-nm'}>{r.rotulo}</span> : null}
          <p>{resto.length > 0 ? <><b>{primeira}.</b> {resto.join('. ')}</> : <b>{r.frase}</b>}</p>
        </div>
      )}
    </section>
  )
}

/** `origem` = o grupo "De onde vêm as views" já renderizado no servidor (o `Suspense` de `OrigemDoVideo`), na ordem: depois da Retenção. */
/** `periodos` = os três cartões de % assistido por período, JÁ renderizados no servidor (o `Suspense` de `AssistidoDoVideo`): o bloco não espera a leitura. */
export function VideoBlocos({ view, periodos, origem }: { view: VideoBlocosView; periodos?: ReactNode; origem?: ReactNode }) {
  return (
    <>
      {view.acesso === 'ok' && view.views ? <SecViews b={view.views} /> : null}
      {view.acesso === 'ok' && view.impressoes ? <SecImpressoes b={view.impressoes} /> : null}
      {view.acesso === 'ok' && view.assistido ? <SecAssistido a={view.assistido} periodos={periodos} /> : null}
      {view.nota ? <div className="vb-nml vb-privado">{view.acesso === 'erro' ? <span className="vb-falhou">falhou</span> : null}<p data-privado-nota="">{view.nota}</p></div> : null}
      <SecRetencao r={view.retencao} />
      {origem !== undefined ? <section className="vb-sec" aria-labelledby="vb-ori-h"><h2 id="vb-ori-h">De onde vêm as views</h2>{origem}</section> : null}
      <section className="vb-sec" aria-labelledby="vb-canal-h">
        <h2 id="vb-canal-h">Este vídeo no canal</h2>
        <Reguas view={view.canal.reguas} />
        {view.canal.notaDiario ? <NaoMedido frase={view.canal.notaDiario} /> : null}
      </section>
      <ForjaIndisponivelVideo view={view.forja} />
      <section className="vb-sec" aria-labelledby="vb-ainda-h">
        <h2 id="vb-ainda-h">O que ainda não há deste vídeo</h2>
        <p className="vb-ainda">{view.ainda}</p>
      </section>
    </>
  )
}
