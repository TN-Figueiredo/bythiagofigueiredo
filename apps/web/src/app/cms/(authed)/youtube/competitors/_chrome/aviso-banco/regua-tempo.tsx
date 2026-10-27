import type { ReactElement } from 'react'
import type { AvisoV2 } from '@/lib/youtube/observatorio/arquivo-mensal/aviso-v2'

/** A régua do tempo: o losango "o banco chega a 85%" e o traço "o próximo mês fica pronto". Só desenhada com a data da saída conhecida. */
export function ReguaTempo({ regua }: { regua: NonNullable<AvisoV2['regua']> }): ReactElement {
  const x85 = regua.losango85, xp = regua.tracoProximaSaida ?? 0
  const alinha = (x: number): string => (x < 14 ? '' : x > 70 ? ' f' : ' c')
  const aria = [regua.rotulo85 ? `o banco chega a 85%: ${regua.rotulo85}` : 'no ritmo de hoje o banco não chega a 85%', regua.rotuloSaida, regua.frase].filter(Boolean).join('. ')
  return (
    <div className="bl-sec">
      <h3 className="bl-h">Quando o banco aperta e quando o espaço volta</h3>
      <div className="bl-rg" role="img" aria-label={aria}>
        {x85 !== null && regua.rotulo85 ? <span className={'bl-l1' + alinha(x85)} style={{ left: `${x85}%` }}>{regua.rotulo85}</span> : null}
        <div className="bl-rt">{regua.alivioDepoisDoAperto && x85 !== null ? <i className="bl-ap" style={{ left: `${x85}%`, width: `${Math.max(xp - x85, 0.8)}%` }} /> : null}</div>
        {x85 !== null ? <span className="bl-mm" style={{ left: `${x85}%` }}><i /></span> : null}
        <i className="bl-trc" style={{ left: `${xp}%` }} />
        <div className="bl-ax" aria-hidden="true"><span style={{ left: 0 }}>hoje</span><span style={{ left: '24.66%' }}>90 dias</span><span style={{ left: '100%' }}>1 ano</span></div>
        {regua.rotuloSaida ? <span className={'bl-l2' + alinha(xp)} style={{ left: `${xp}%` }}>{regua.rotuloSaida}</span> : null}
      </div>
      {regua.frase ? <p className={'bl-aper' + (regua.alivioDepoisDoAperto ? '' : ' calmo')}>{regua.alivioDepoisDoAperto ? <b>{regua.frase.split(':')[0]}:</b> : null}{regua.alivioDepoisDoAperto ? regua.frase.slice(regua.frase.indexOf(':') + 1) : regua.frase}</p> : null}
      <ul className="bl-leg"><li><i className="bl-lg-d" />o banco chega a 85%</li><li><i className="bl-lg-t" />o próximo mês fica pronto para sair</li></ul>
    </div>
  )
}
