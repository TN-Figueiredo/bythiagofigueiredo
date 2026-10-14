'use client'
// A5 · E17 degrau 1, Tarefa 10: a barra de tamanho. Cheia até onde a cópia vai; listrada onde só "Baixar completo" leva; pontilhada onde nada leva.
// Os números vêm de `resumir()`; aqui só viram largura.
import * as F from './frases-do-dialogo'

export interface MedidasDaBarra { total: number; copia: number; soArquivo: number; completo: number; naoSaem: number; cabe: boolean; limite: number }

export function BarraDeTamanho({ m }: { m: MedidasDaBarra }) {
  const dom = Math.max(m.total, m.limite)
  const pc = (v: number): string => `${((v / dom) * 100).toFixed(2)}%`
  const aria = m.cabe ? F.barraCabe(m.total, m.limite) : F.barraCortou(m.copia, m.soArquivo, m.naoSaem)
  return (
    <>
      <div className={`pi-bar ${m.cabe ? 'ok' : 'cut'}`} role="img" aria-label={aria}>
        <i className="pi-bar-f" style={{ width: pc(m.copia) }} />
        {m.soArquivo > 0 && <i className="pi-bar-s" style={{ left: pc(m.copia), width: pc(m.soArquivo) }} />}
        {m.naoSaem > 0 && <i className="pi-bar-d" style={{ left: pc(m.completo), width: pc(m.naoSaem) }} />}
        {!m.cabe && <i className="pi-bar-t" style={{ left: pc(m.limite) }} />}
      </div>
      <ul className="pi-leg">
        {m.cabe ? (
          <>
            <li><i className="pi-sw f ok" aria-hidden="true" />{F.legendaNoPacote(m.total)}</li>
            <li><i className="pi-sw lim" aria-hidden="true" />{F.legendaLimite(m.limite)}</li>
          </>
        ) : (
          <>
            <li><i className="pi-sw f cut" aria-hidden="true" />{F.legendaVaoNaCopia(m.copia)}</li>
            <li><i className="pi-sw s" aria-hidden="true" />{F.legendaSoNoArquivo(m.soArquivo)}</li>
            {m.naoSaem > 0 && <li><i className="pi-sw d" aria-hidden="true" />{F.legendaNaoSaem(m.naoSaem)}</li>}
          </>
        )}
      </ul>
    </>
  )
}
