import type { ReactElement } from 'react'
import type { AvisoV2 } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-v2'
import { FormaBl } from './formas'
import { ReguaTempo } from './regua-tempo'

const AMARELO = 70, VERMELHO = 85

/** O painel do ⓘ da pastilha. Os MB não aparecem aqui: ficam na conta da tela de Canais. */
export function PainelAvisoBanco({ aviso, arquivoHref }: { aviso: AvisoV2; arquivoHref: string }): ReactElement {
  const { pastilha, barra, regua, linhaDaCopia, oQueLibera, casa } = aviso
  const cls = pastilha.cor === 'ambar' ? 'amarelo' : pastilha.cor === 'vermelho' ? 'vermelho' : pastilha.cor === 'nao_medido' ? 'vazia' : 'verde'
  const w = barra.hojePct === null ? 0 : Math.min(barra.hojePct, 100)
  const g = barra.chegaAPct === null ? null : Math.min(barra.chegaAPct, 100)
  const nivelHoje = barra.hojePct === null ? 'vz' : barra.hojePct >= VERMELHO ? 'vermelho' : barra.hojePct >= AMARELO ? 'amarelo' : 'verde'
  return (
    <div className="bl" data-testid="painel-aviso-banco">
      <h3 className="bl-h">Banco do site</h3>
      {barra.hojePct === null
        ? <p className="bl-fr">Sem a leitura do tamanho do banco: nada indica que está tudo bem nem que está ruim.</p>
        : <p className="bl-fr"><b>{pastilha.pct !== null ? `${pastilha.pct}% do limite hoje.` : `Última leitura: ${barra.hojePct}% do limite.`}</b> {barra.rotuloChegaA ? <span data-testid="chega-a">{barra.rotuloChegaA[0]!.toUpperCase() + barra.rotuloChegaA.slice(1)}.</span> : null}</p>}
      <div className="bl-bar" role="img" aria-label={barra.hojePct === null ? 'Banco do site: não medido' : `Banco do site: ${barra.hojePct}% do limite${barra.chegaAPct !== null ? `, e chega a ${barra.chegaAPct}% antes da próxima saída` : ''}. Corte amarelo em ${AMARELO}% e vermelho em ${VERMELHO}%.`}>
        <div className={'bl-bt' + (barra.hojePct === null ? ' vz' : '')}>
          {w ? <i className={'bl-f ' + nivelHoje} style={{ width: `${w}%` }} /> : null}
          {g !== null && g > w ? <i className={'bl-gh ' + cls} style={{ left: `${w}%`, width: `${g - w}%` }} /> : null}
          <i className="bl-tk" style={{ left: `${AMARELO}%` }} /><i className="bl-tk" style={{ left: `${VERMELHO}%` }} />
        </div>
        <div className="bl-ts" aria-hidden="true"><span style={{ left: 0 }}>0%</span><span style={{ left: `${AMARELO}%` }}>{AMARELO}%</span><span style={{ left: `${VERMELHO}%` }}>{VERMELHO}%</span><span style={{ left: '100%' }}>100%</span></div>
        {barra.rotuloChegaA ? <p className={'bl-pt ' + cls} data-testid="rotulo-chega-a"><FormaBl forma={pastilha.cor === 'vermelho' ? 'octogono' : 'triangulo'} />{barra.rotuloChegaA}</p> : null}
      </div>
      {casa ? (
        <div className="bl-faz" role="note">
          <p><FormaBl forma={casa.forma} /><b>{casa.texto}</b></p>
          <p className="bl-faz-t"><b>O que fazer:</b></p>
          <ol>{casa.oQueFazer.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </div>
      ) : null}
      {regua ? <ReguaTempo regua={regua} /> : null}
      {oQueLibera ? <div className="bl-sec"><h3 className="bl-h">O que libera espaço</h3><ol className="bl-lib">{oQueLibera.map((t, i) => <li key={i}>{t}</li>)}</ol></div> : null}
      <div className={'bl-cp ' + linhaDaCopia.forma} role="note" data-testid="linha-da-copia" data-forma={linhaDaCopia.forma}>
        <span className="bl-ci"><FormaBl forma={linhaDaCopia.forma} /></span>
        <p>{linhaDaCopia.texto}{linhaDaCopia.portaArquivo ? <> <a className="bl-porta" href={arquivoHref}>Abrir o Arquivo</a></> : null}</p>
      </div>
      <p className="bl-info">A cópia é mensal e sempre, não depende do tamanho. A cor segue o mais alto que o banco chega antes da próxima saída; a barra mostra o tamanho de hoje. Se a casa fica mais de 36 horas sem responder, o aviso passa de triângulo a octógono.</p>
    </div>
  )
}
