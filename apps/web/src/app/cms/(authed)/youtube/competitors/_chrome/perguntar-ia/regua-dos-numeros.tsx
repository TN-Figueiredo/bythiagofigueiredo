'use client'
// A5 · E17 degrau 1, Tarefa 10: a régua "Os números no pacote": medido (bloco), zero medido (caixa vazada) e não medido (hachura), sempre as três na legenda.
import * as F from './frases-do-dialogo'

export function ReguaDosNumeros({ medidos, zeros, naoMedidos }: { medidos: number; zeros: number; naoMedidos: number }) {
  const tot = medidos + zeros + naoMedidos
  const w = (v: number): string => (v ? `${Math.max((v / tot) * 100, 2.2).toFixed(2)}%` : '0')
  return (
    <>
      {tot === 0 ? (
        <div className="pi-bn vazio" role="img" aria-label={F.REGUA_VAZIA_ARIA} />
      ) : (
        <div className="pi-bn" role="img" aria-label={F.reguaAria(medidos, zeros, naoMedidos)}>
          {medidos > 0 && <i className="m" style={{ flexBasis: w(medidos) }} />}
          {zeros > 0 && <i className="z" style={{ flexBasis: w(zeros) }} />}
          {naoMedidos > 0 && <i className="n" style={{ flexBasis: w(naoMedidos) }} />}
        </div>
      )}
      <ul className="pi-leg pi-leg-n">
        <li><i className="pi-sw m" aria-hidden="true" /><b>{F.milhar(medidos)}</b> medidos</li>
        <li><i className="pi-sw zero" aria-hidden="true" /><b>{F.milhar(zeros)}</b> {zeros === 1 ? 'zero medido' : 'zeros medidos'}</li>
        <li><i className="pi-sw nao-medido" aria-hidden="true" /><b>{F.milhar(naoMedidos)}</b> {naoMedidos === 1 ? 'não medido' : 'não medidos'}</li>
      </ul>
    </>
  )
}
