/**
 * E5a Tarefa 21a: a régua das 72 horas: quando o vídeo chegou a 1/4, 1/2 e 3/4 das views das 72 horas, e quando chegou o normal do canal.
 * Marca que não existe vira ponto hachurado na ponta de 0 h. Rótulos que se tocam descem para a segunda linha (`nivelDosRotulos`).
 * Componente de servidor; tudo o que a régua diz está também na frase `aria` e nas frases do motivo.
 */
import { nivelDosRotulos, type ReguaDeHoras } from './horas-model'
import './historico-medidas.css'

/** A largura que a trilha tem na tela de 1240 px, só para decidir quais rótulos se tocam; o desenho em si é em porcentagem. */
const LARGURA_ESTIMADA_PX = 640
const LARGURA_DO_ROTULO_PX = 74
const pct = (h: number): number => Math.max(0, Math.min(100, (h / 72) * 100))

export function Regua72h({ regua }: { regua: ReguaDeHoras }) {
  const xs = regua.video.map((m) => (m.horas === null ? 0 : (pct(m.horas) / 100) * LARGURA_ESTIMADA_PX))
  const niv = nivelDosRotulos(xs, LARGURA_DO_ROTULO_PX)
  const normal = regua.normal
  const nXs = normal.tipo === 'medido' ? normal.marcas.map((m) => (pct(m.horas) / 100) * LARGURA_ESTIMADA_PX) : []
  const nNiv = nivelDosRotulos(nXs, LARGURA_DO_ROTULO_PX)
  const dois = niv.some((n) => n === 1) || nNiv.some((n) => n === 1)
  return (
    <div className="hv-reg" role="group" aria-label={regua.aria} data-regua>
      <div className="hv-rl">
        <span>Este vídeo</span>
        <div className={'hv-rt' + (dois ? ' dois' : '')}>
          {regua.video.map((m, k) =>
            m.horas === null ? (
              <div key={m.fracao} className="hv-rk nmk" data-marca={m.fracao} data-estado="nao_medido"><span><i /></span><span>{m.fracao}: não medido</span></div>
            ) : (
              <div key={m.fracao} className={'hv-rk' + (niv[k] === 1 ? ' dn' : '')} style={{ left: `${pct(m.horas)}%` }} data-marca={m.fracao} data-horas={m.horas}>
                <span>{m.horas} h</span><i /><span>{m.fracao}</span>
              </div>
            ),
          )}
        </div>
      </div>
      <div className="hv-rl">
        <span>Normal do canal</span>
        {normal.tipo === 'medido' ? (
          <div className={'hv-rt' + (dois ? ' dois' : '')}>
            {normal.marcas.map((m, k) => (
              <div key={m.fracao} className={'hv-rk n' + (nNiv[k] === 1 ? ' dn' : '')} style={{ left: `${pct(m.horas)}%` }} data-marca={m.fracao} data-horas={m.horas}>
                <span>{m.horas} h</span><i /><span>{m.fracao}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="hv-rt nmr" role="img" aria-label={normal.frase} data-normal={normal.tipo} />
        )}
      </div>
      <div className="hv-ra" aria-hidden="true">{regua.eixo.map((h) => <span key={h}>{h} h</span>)}</div>
      {normal.tipo !== 'medido' ? <p className="hv-rleg" data-frase-do-normal>{normal.frase}</p> : null}
      {regua.frasesDoVideo.map((f, i) => <p key={i} className="hv-rleg" data-frase-do-video>{f}</p>)}
    </div>
  )
}
