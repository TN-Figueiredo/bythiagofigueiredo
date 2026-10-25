'use client'

// Blocos da tela v2 do teste A/B (S8-F4 T12, T6). Só desenham o modelo `TelaV2`: nenhuma conta aqui.
// Nulo é "não medido", nunca 0. Textos: mockup M5 r5 e tabela ◆T do plano.
import type { DisplayLabel } from '@/lib/youtube/ab-types'
import type { LinhaPisoV2 } from '@/lib/youtube/ab-gravacao/tela-v2'
import { InfoDica } from '../../_components/info-dica'
import './caminho-nativo.css'
import './blocos-v2.css'

const PISO_DIAS = 4
const milhar = (n: number): string => n.toLocaleString('pt-BR')

export function ResumoV2({ frase, ilegivel }: { frase: { principal: string; apoio: string | null }; ilegivel?: boolean }) {
  return (
    <>
      {ilegivel ? (
        <div className="pv2-selos"><span className="pv2-sel errf" role="status"><span aria-hidden="true">⚠</span> Não consegui ler</span></div>
      ) : null}
      <p className="pv2-sum">
        {frase.principal}
        {frase.apoio ? <small>{frase.apoio}</small> : null}
      </p>
    </>
  )
}

export function AndamentoV2({ dia, teto, pausado }: { dia: number; teto: number; pausado: boolean }) {
  const passou = dia > teto
  const f = teto - dia
  const paragrafo = pausado
    ? 'Um quadrado por dia corrido; o contorno forte é hoje. O teste também exige um mínimo de dias corridos antes de decidir. Isso não indica quem está na frente.'
    : `Um quadrado por dia corrido; o contorno forte é hoje. O teste também exige um mínimo de dias corridos antes de decidir, e encerra sozinho no dia ${teto}. Isso não indica quem está na frente.`
  return (
    <div className="pv2-sec pv2-rel" data-section="andamento-v2">
      <div className="pv2-sh">Andamento <InfoDica titulo="Andamento" paragrafos={[paragrafo]} rotulo="Como ler o andamento" /></div>
      <div className="pv2-top">
        <span className="pv2-dia num">{passou ? `Dia ${dia} · passou do fim (${teto})` : `Dia ${dia} de ${teto}`}</span>
        <span className="pv2-falta">
          {pausado ? '⏸ pausado' : passou ? null : f > 0 ? `faltam ${f} ${f === 1 ? 'dia' : 'dias'}` : 'último dia'}
        </span>
      </div>
      <div className="pv2-ticks" style={{ gridTemplateColumns: `repeat(${teto}, 1fr)` }} aria-hidden="true">
        {Array.from({ length: teto }, (_, i) => <i key={i} className={i + 1 < dia ? 'p' : i + 1 === dia ? 'h' : ''} />)}
      </div>
    </div>
  )
}

const CHIP: Record<DisplayLabel, string> = { A: 'pv2-cA', B: 'pv2-cB', C: 'pv2-cC', D: 'pv2-cD' }

export function PisosV2({ linhas, n, final }: { linhas: LinhaPisoV2[]; n: number | null; final: boolean }) {
  const comum = 'Dias e impressões são somados dos dias válidos do placar; o piso vem da avaliação diária. “—” é não medido, não zero.'
  const paragrafo = `O teste só decide se cada versão tiver pelo menos ${PISO_DIAS} dias válidos e ${n !== null ? `${milhar(n)} impressões` : 'o mínimo de impressões'} nos dias válidos. ${comum}`
  return (
    <div className="pv2-sec" data-section="pisos-v2">
      <div className="pv2-sh">
        <h3 className="pv2-h">{final ? 'Quanto o teste alcançou' : 'Falta para decidir'}</h3>
        <InfoDica titulo={final ? 'Régua final' : 'Pisos'} paragrafos={[paragrafo]} rotulo={final ? 'Como ler a régua final' : 'Como ler os pisos'} />
      </div>
      <div className="pv2-pisos">
        {linhas.map(l => {
          const tem = l.volume !== null
          const ok = tem && n !== null && (l.volume as number) >= n
          const pc = tem && n !== null && n > 0 ? Math.min(100, Math.max((l.volume as number) > 0 ? 2 : 0, ((l.volume as number) / n) * 100)) : 0
          const semPiso = tem && n === null
          return (
            <div className="pv2-pr" role="group" aria-label={`Variante ${l.letra}`} key={l.variant_id}>
              <div className="pv2-vh">
                <span className={`pv2-chip ${CHIP[l.letra]}`}>{l.letra}</span>
                <div className="pv2-vt"><b title={l.titulo}>{l.titulo}</b></div>
              </div>
              <div>
                <div className={`pv2-pbar${tem ? '' : ' vz'}${ok ? ' pv2-ok' : ''}`} aria-hidden="true">{tem && !semPiso ? <i style={{ width: `${pc}%` }} /> : null}</div>
                <div className="pv2-pnum" aria-label={semPiso ? `Impressões ${l.volume}; piso não calculado` : undefined}>
                  <span>
                    Impressões{' '}
                    {tem ? (
                      <><b className="num">{milhar(l.volume as number)}</b> de <span className="num">{n !== null ? milhar(n) : '—'}</span>{ok ? <> <span className="pv2-okk" aria-label="piso atingido">✓</span></> : null}{semPiso ? <> <span className="pv2-nm">piso não calculado</span></> : null}</>
                    ) : (
                      <><span className="dash">—</span> <span className="pv2-nm">não medido</span></>
                    )}
                  </span>
                </div>
              </div>
              <div className="pv2-pdv">
                Dias válidos{' '}
                {l.dias_validos === null ? (
                  <><span className="dash">—</span> ∅</>
                ) : (
                  <><b className="num">{l.dias_validos}</b>{l.dias_validos >= PISO_DIAS ? <> (mínimo {PISO_DIAS}) <span className="pv2-okk" aria-label="piso atingido">✓</span></> : <> de {PISO_DIAS}</>}</>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function SinalV2({ letra }: { letra: DisplayLabel }) {
  return (
    <div className="pv2-sinal">
      <div className="l"><span className="sy" aria-hidden="true">▲</span><span><b>Sinal provisório, não decide:</b> {letra} está um pouco à frente.</span></div>
    </div>
  )
}
