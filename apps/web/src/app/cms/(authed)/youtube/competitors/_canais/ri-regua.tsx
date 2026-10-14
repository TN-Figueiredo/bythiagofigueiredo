/** A régua de Referências (log), a escala grudada e a barra divergente de Inscritos. Só desenham o que vem em `RiView`. */
import type { RiLinhaIns, RiLinhaRef, RiView } from './ri-tipos'

export function RiEscala({ ticks }: { ticks: RiView['ticks'] }) {
  return (
    <div className="ri-esc" aria-hidden="true">
      <div>
        {ticks.map((t) => (
          <span key={t.rotulo} style={{ left: `${t.pos.toFixed(1)}%` }}>
            {t.rotulo}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Mediana (marca), faixa do quarto ao terceiro quarto e traços das escalas. Provisória: trilho pontilhado e marca vazada. */
export function RiRegua({ linha, ticks }: { linha: RiLinhaRef; ticks: RiView['ticks'] }) {
  if (linha.marca == null) return null
  const prov = linha.provisoria
  return (
    <div className={prov ? 'reg pt' : 'reg'} role="img" aria-label={linha.ariaLabel}>
      {ticks.map((t) => (
        <span key={t.rotulo} className="tk" style={{ left: `${t.pos}%` }} />
      ))}
      <span className="trilho" />
      {linha.faixa && !prov ? <span className="faixa" style={{ left: `${linha.faixa.de}%`, width: `${linha.faixa.ate - linha.faixa.de}%` }} /> : null}
      <span className={prov ? 'mk pv' : 'mk'} style={{ left: `${linha.marca}%` }} />
    </div>
  )
}

export function RiBarra({ linha }: { linha: RiLinhaIns }) {
  if (linha.barra == null || linha.classe == null) return null
  return (
    <div className="dv" role="img" aria-label={linha.ariaLabel}>
      <span className="eixo" />
      {linha.classe === 'eq' ? <span className="b eq" /> : <span className={`b ${linha.classe}`} style={{ width: `${linha.barra.toFixed(1)}%` }} />}
    </div>
  )
}
