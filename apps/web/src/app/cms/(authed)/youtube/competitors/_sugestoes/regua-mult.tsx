// Régua do múltiplo (F3 T5): escala log de 1× a 20×; o traço marca o limiar da regra. Elemento gráfico em --btn-line (>= 3:1).
const X0 = 8
const X1 = 152
const f1 = (n: number): string => n.toFixed(1).replace('.', ',')
const lx = (v: number): number => X0 + (Math.log(Math.min(Math.max(v, 1), 20)) / Math.log(20)) * (X1 - X0)

export function ReguaMult(p: { valor: number; acimaDe20: boolean; limiar: number }) {
  const t = lx(p.limiar).toFixed(1)
  const x = lx(p.valor).toFixed(1)
  const fonte = '12px Inter,system-ui,sans-serif'
  return (
    <svg className="sg-rg-svg" width={160} height={36} viewBox="0 0 160 36" role="img"
      aria-label={`${f1(p.valor)} vezes o normal do canal; o traço marca a regra ${p.limiar}×`}>
      <line className="sg-rg-trilha" x1={X0} y1={10} x2={X1} y2={10} style={{ stroke: 'var(--btn-line)', strokeWidth: 4, strokeLinecap: 'round' }} />
      {p.acimaDe20
        ? <path className="sg-rg-marca" d={`M${X1 - 7} 3l9 7-9 7z`} style={{ fill: 'var(--text)' }} />
        : <circle className="sg-rg-marca" cx={x} cy={10} r={6} style={{ fill: 'var(--text)', stroke: 'var(--surface)', strokeWidth: 2 }} />}
      <line className="sg-rg-contorno" x1={t} y1={0} x2={t} y2={20} style={{ stroke: 'var(--surface)', strokeWidth: 4 }} />
      <line className="sg-rg-limiar" x1={t} y1={0} x2={t} y2={20} style={{ stroke: 'var(--text)', strokeWidth: 2 }} />
      <text x={X0} y={32} textAnchor="start" style={{ fill: 'var(--muted)', font: '400 ' + fonte }}>1×</text>
      <text x={t} y={32} textAnchor="middle" style={{ fill: 'var(--text)', font: '600 ' + fonte }}>{`regra ${p.limiar}×`}</text>
      <text x={X1} y={32} textAnchor="end" style={{ fill: 'var(--muted)', font: '400 ' + fonte }}>{p.acimaDe20 ? '20×+' : '20×'}</text>
    </svg>
  )
}
