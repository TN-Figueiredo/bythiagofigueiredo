/**
 * E5a Tarefa 16: o bloco "Para onde o canal anda". Componente de servidor, sem estado. As três linhas e a queda sustentada vêm prontas do
 * modelo; aqui só se desenha. Quatro estados que não trocam de aparência: régua (medido), barra com data, hachura, casas pontilhadas.
 */
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { Direcao } from '../../_chrome/medidas/direcao'
import { ReguaDirecao } from '../../_chrome/medidas/regua-direcao'
import { RiInfo } from '../../_canais/ri-info'
import { BarraDeProgresso } from './barra-de-progresso'
import { TOTAL_CANAL, TOTAL_JUSTA, TOTAL_QUEDA, type BlocoDeDirecao, type CasaDaQueda, type LinhaDeDirecao } from './direcao-model'
import { PastilhaAusencia } from '../../_chrome/ausencia/pastilhas'
import { dm, dmy } from './formatos'
import './canal-medidas.css'

const COR: Record<string, string> = { sobe: 'up', estavel: 'eq', desce: 'dn' }
const GLIFO: Record<string, string> = { sobe: '▲', estavel: '＝', desce: '▼' }

function Sim({ simbolo }: { simbolo: string }) {
  return <span className={`pc-sim ${COR[simbolo]}`} aria-hidden="true">{GLIFO[simbolo]}</span>
}

function Linha({ l }: { l: LinhaDeDirecao }) {
  const rotulo = (
    <div className="pc-dl"><b>{l.nome}</b><span>{l.sub}</span></div>
  )
  if (l.estado === 'medido') {
    return (
      <div className={`pc-dr${l.principal ? ' main' : ''}`} data-linha={l.chave}>
        {rotulo}
        <div className="pc-dg"><ReguaDirecao limite={50} pct={l.pct} foraDaEscala={l.foraDaEscala} exato={l.exato} /></div>
        <div className="pc-dv">
          <Direcao variante="contorno" simbolo={l.simbolo} pct={l.pct} />
          {l.foraDaEscala ? <span className="pc-sat">{l.foraDaEscala === 'acima' ? 'ou mais' : 'ou menos'}, fora da escala</span> : null}
        </div>
        <p className="pc-db">
          {l.base.tipo === 'views'
            ? <><b className="num">{l.base.recente}</b> views contra <b className="num">{l.base.anterior}</b></>
            : <><b className="num">{l.base.recente}</b> contra <b className="num">{l.base.anterior}</b> views ({l.base.n} vídeos no total)</>}
          {l.aviso ? <span className="pc-av"><span aria-hidden="true">⚠</span>{l.aviso}</span> : null}
          {l.dica ? <span className="pc-av">{l.dica}</span> : null}
        </p>
      </div>
    )
  }
  if (l.estado === 'nao_carregou') {
    return (
      <div className={`pc-dr${l.principal ? ' main' : ''}`} data-linha={l.chave}>
        {rotulo}
        <div className="pc-dg"><div className="pc-nmw"><div className="pc-nmbar" aria-hidden="true" /><p className="pc-pgl">{l.motivo}</p></div></div>
        <div className="pc-dv"><PastilhaAusencia estado="falhou" /></div>
      </div>
    )
  }
  return (
    <div className={`pc-dr${l.principal ? ' main' : ''}`} data-linha={l.chave}>
      {rotulo}
      <div className="pc-dg">
        {l.estado === 'progresso' ? (
          <div className="pc-nmw">
            <BarraDeProgresso feitos={l.progresso.feitos} total={l.progresso.total} rotulo={l.nome} />
            <p className="pc-pgl">
              <b className="num">{l.progresso.feitos} de {l.progresso.total} dias</b> · {l.motivo}; passa a existir em <b className="num">{dmy(l.progresso.fechaEm)}</b>
            </p>
          </div>
        ) : (
          <div className="pc-nmw"><div className="pc-nmbar" aria-hidden="true" /><p className="pc-pgl">{l.motivo}</p></div>
        )}
      </div>
      <div className="pc-dv"><span className="obs-ch-nm">não medido</span></div>
    </div>
  )
}

function Casa({ c }: { c: CasaDaQueda }) {
  if (c.estado === 'medida') {
    return (
      <li className={`pc-ca ${COR[c.simbolo]}`}>
        <span className="pc-cn">{c.rotulo}</span>
        <span className="pc-cv"><span aria-hidden="true">{GLIFO[c.simbolo]}</span> <b className="num">{c.texto}</b></span>
      </li>
    )
  }
  if (c.estado === 'ainda_nao_existe') {
    return <li className="pc-ca ae"><span className="pc-cn">{c.rotulo}</span><span className="pc-cv">ainda não existe</span></li>
  }
  return <li className="pc-ca nm"><span className="pc-cn">{c.rotulo}</span><span className="pc-cv">não medido</span></li>
}

export function DirecaoBloco({ bloco }: { bloco: BlocoDeDirecao }) {
  const { frase, linhas, queda } = bloco
  const n = MEASURE_RULES.direction.windowDays
  const itens = [
    'Três leituras: cada uma compara o canal com ele mesmo, nunca com outro canal.',
    `Views do canal inteiro: views ganhas nos últimos ${n} dias ÷ nos ${n} anteriores, pelo contador público do canal. Inclui Shorts e vídeos apagados. Pede ${TOTAL_CANAL} dias de registro.`,
    `Vídeos novos, views de hoje: mediana das views de hoje dos vídeos longos publicados nos últimos ${MEASURE_RULES.channelWindowDays} dias ÷ a dos ${MEASURE_RULES.channelWindowDays} anteriores. Descer pode ser só idade; subir apesar disso é um bom sinal.`,
    `Leitura justa: a mesma conta com as views dos 30 primeiros dias de cada vídeo, sem o viés de idade. Só existe depois de ${TOTAL_JUSTA} dias de contagem por vídeo.`,
    `Queda sustentada: três janelas de ${n} dias seguidas, cada uma com −10% ou menos contra a anterior; pede ${TOTAL_QUEDA} dias limpos depois de ${dm(MEASURE_RULES.countChange)}.`,
    'Faixa do meio: de −10% a +10% é “sem mudança”, em cinza.',
  ]
  return (
    <section className="pc-sec" id="direcao" aria-labelledby="hDir">
      <div className="pc-sh">
        <h2 id="hDir" data-valor>Para onde o canal anda</h2>
        <RiInfo titulo="a direção do canal" itens={itens} rotuloBotao="Como ler a direção do canal" />
      </div>
      <p className="pc-fr2" data-frase-do-bloco>
        {frase.simbolo ? <Sim simbolo={frase.simbolo} /> : null}
        <span><b>{frase.negrito}</b>{frase.resto}</span>
      </p>
      <div className="pc-drs">
        {linhas.map(l => <Linha key={l.chave} l={l} />)}
        <div className="pc-esc" data-linha="queda">
          <div className="pc-dl"><b>Queda sustentada</b><span>três janelas de {n} dias seguidas, cada uma contra a anterior</span></div>
          <ol className="pc-cas" aria-label={`As três janelas de ${n} dias`}>{queda.casas.map(c => <Casa key={c.rotulo} c={c} />)}</ol>
          <div className="pc-dv">
            {queda.estado === 'medida'
              ? (queda.emQueda ? <span className="pc-est queda"><span aria-hidden="true">▼</span><span>Em queda sustentada</span></span> : <span className="pc-est ativo"><span aria-hidden="true">✓</span><span>Fora da queda</span></span>)
              : queda.estado === 'nao_carregou' ? <PastilhaAusencia estado="falhou" />
              : <span className="obs-ch-nm">não medido</span>}
          </div>
          {queda.estado === 'progresso' ? (
            <div className="pc-nmw pc-escp">
              <BarraDeProgresso feitos={queda.progresso.feitos} total={queda.progresso.total} rotulo="dias limpos de leitura" />
              <p className="pc-pgl"><b className="num">{queda.progresso.feitos} de {queda.progresso.total} dias</b> · {queda.motivo}; passa a existir em <b className="num">{dmy(queda.progresso.fechaEm)}</b></p>
            </div>
          ) : queda.estado === 'medida'
            ? <p className="pc-db">É “em queda sustentada” quando as três ficam em ▼ −10% ou menos.</p>
            : <p className="pc-db">{queda.motivo}</p>}
        </div>
      </div>
      <p className="pc-leg"><span><b className="up">▲</b> subindo: +10% ou mais</span><span><b className="eq">＝</b> sem mudança</span><span><b className="dn">▼</b> descendo: −10% ou menos</span></p>
    </section>
  )
}
