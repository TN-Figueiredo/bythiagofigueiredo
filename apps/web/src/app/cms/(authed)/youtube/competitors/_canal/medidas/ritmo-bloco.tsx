/**
 * E5a Tarefa 16: o bloco "Ritmo e regularidade". Componente de servidor, sem estado. Treze casas por semana, duas raias; caixa vazada com 0
 * é semana medida sem publicação; hachura com "—" é semana não lida (nunca zero).
 */
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { ZeroMedido } from '../../_chrome/medidas/marcas'
import { RiInfo } from '../../_canais/ri-info'
import { dm } from './formatos'
import type { BlocoDeRitmo, CartaoDeRitmo, CasaDaSemana, RaiaDeRitmo } from './ritmo-model'
import './canal-medidas.css'

function Casa({ c }: { c: CasaDaSemana }) {
  if (c.estado === 'nao_lida') {
    return <li className="pc-cs nm" title={c.por}><span className="pc-nmg" aria-hidden="true">—</span><span className="obs-md-sr">não medido: {c.por}</span></li>
  }
  if (c.estado === 'zero') {
    return <li className="pc-cs zero"><span aria-hidden="true"><ZeroMedido /></span><span className="obs-md-sr">nenhuma publicação</span></li>
  }
  return <li className="pc-cs com"><b className="num">{c.n}</b><span className="pc-csb" style={{ height: `${Math.round(6 + 34 * c.fracao)}px` }} /></li>
}

function Raia({ r }: { r: RaiaDeRitmo }) {
  if (r.ausente) {
    return <div className="pc-sem"><b className="pc-semr">{r.rotulo}</b><p className="pc-semz"><ZeroMedido />{r.rotulo === 'Longos' ? 'nenhum vídeo longo' : 'nenhum Short'} nas {MEASURE_RULES.rhythm.weeks} semanas</p></div>
  }
  return (
    <div className="pc-sem">
      <b className="pc-semr">{r.rotulo}</b>
      <ol className="pc-cs-l" aria-label={`Publicações por semana, ${r.rotulo}, das ${MEASURE_RULES.rhythm.weeks} últimas semanas`}>
        {r.casas.map((c, i) => <Casa key={i} c={c} />)}
      </ol>
    </div>
  )
}

function Cartao({ c }: { c: CartaoDeRitmo }) {
  return (
    <li data-cartao={c.chave}>
      <span>{c.rotulo}</span>
      {c.valor.tipo === 'medido' ? <><b className="num">{c.valor.texto}</b>{c.valor.pequeno ? <small className="num">{c.valor.pequeno}</small> : null}</>
        : c.valor.tipo === 'nao_carregou' ? <span className="obs-md-nc" role="alert"><span>Não carregou</span></span>
        : <span className="obs-ch-nm" title={c.valor.motivo}>não medido<span className="obs-md-sr">: {c.valor.motivo}</span></span>}
    </li>
  )
}

export function RitmoBloco({ bloco }: { bloco: BlocoDeRitmo }) {
  const n = MEASURE_RULES.rhythm.weeks
  const itens = [
    'Casas: uma por semana, das 13 últimas, com o número de publicações do formato da raia; caixa vazada com 0 é semana medida sem publicação; hachura com “—” é semana não medida (ainda não buscada, ou que termina depois da última leitura).',
    `Intervalo típico: mediana dos dias entre uma publicação e a seguinte, no formato principal, nas últimas ${n} semanas.`,
    'Semanas com publicação: quantas das semanas lidas tiveram pelo menos um vídeo do formato principal. O outro formato aparece na raia de baixo e não entra nesta conta.',
    `Maior buraco: o maior intervalo entre duas publicações do formato principal nas últimas ${MEASURE_RULES.rhythm.gapWeeks} semanas; conta também o intervalo ainda aberto.`,
    `Parado: dias desde o último vídeo maiores que o maior entre ${MEASURE_RULES.stalled.floorDays} e ${MEASURE_RULES.stalled.factor} vezes o intervalo mediano.`,
    `Não medido: menos de ${MEASURE_RULES.rhythm.minPosts} vídeos do formato principal na janela, ou canal ainda buscando vídeos.`,
  ]
  const p = bloco.ponteiro
  return (
    <section className="pc-sec" id="ritmo" aria-labelledby="hRit">
      <div className="pc-sh">
        <h2 id="hRit">Ritmo e regularidade</h2>
        <RiInfo titulo="o ritmo e a regularidade" itens={itens} rotuloBotao="Como ler o ritmo e a regularidade" />
      </div>
      <p className="pc-fr2" data-frase-do-bloco><span><b>{bloco.frase.negrito}</b>{bloco.frase.resto}</span></p>
      {bloco.raias.length > 0 ? (
        <div className="pc-sems">
          <p className="pc-rola" data-rola>Arraste para o lado para ver as {n} semanas.</p>
          {bloco.raias.map(r => <Raia key={r.rotulo} r={r} />)}
          <p className="pc-eixo"><span>há {n} semanas</span><span>{bloco.eixoFim}</span></p>
        </div>
      ) : null}
      {p ? (
        <div className="pc-par">
          <div className="pc-dl">
            <span className="pc-dn">
              {p.passou ? <span className="pc-sim dn" aria-hidden="true">‖</span> : null}
              <b className={`num${p.passou ? ' dn' : ''}`}>{p.dias} {p.dias === 1 ? 'dia' : 'dias'}</b>
            </span>
            <span>{p.rotulo}{p.ate ? `, até ${dm(p.ate)}` : p.pelaBusca ? ', pelo que já foi buscado' : ''}</span>
          </div>
          <div
            className="pc-rp"
            role="img"
            aria-label={`${p.dias} ${p.dias === 1 ? 'dia' : 'dias'} sem publicar${p.ate ? `, até ${dm(p.ate)}` : ''}${p.tipico !== null ? `; o intervalo típico é ${Math.round(p.tipico)} dias` : ''}; o limite para “parado” é ${p.limite} dias`}
          >
            <span className={`pc-rp-f${p.passou ? ' dn' : ''}`} style={{ width: `${Math.min(100, (100 * p.dias) / p.escala).toFixed(1)}%` }} />
            {p.tipico !== null && p.tipico < p.limite ? (
              <span className="pc-rp-t" style={{ left: `${((100 * p.tipico) / p.escala).toFixed(1)}%` }}><i /><em>típico: {Math.round(p.tipico)} d</em></span>
            ) : null}
            <span className="pc-rp-l" style={{ left: `${((100 * p.limite) / p.escala).toFixed(1)}%` }}><i /><em>parado: {p.limite} d</em></span>
          </div>
        </div>
      ) : null}
      <ul className="pc-mets">{bloco.cartoes.map(c => <Cartao key={c.chave} c={c} />)}</ul>
    </section>
  )
}
