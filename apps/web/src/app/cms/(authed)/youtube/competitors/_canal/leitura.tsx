'use client'
/**
 * A aba Leitura do canal do concorrente (spec 5.8, pergunta 1, 7.1): a leitura POR CANAL ainda não existe (depende do tipo
 * `leitura-canal`, 7.3), então a aba mostra a leitura do NICHO, rotulada como tal, com o botão do canal apagado. Este módulo é só a
 * moldura e os textos; o cartão (`ReadingCard`, de Mudanças) chega como `children`, montado pela página com o conjunto do site.
 */
import type { ReactNode } from 'react'

export function LeituraDoNicho({ nicheLabel, children }: { nicheLabel: string | null; children: ReactNode }) {
  return (
    <section aria-label="Leitura da forja" className="cl-sec">
      <h2 className="cl-h2" id="cl-h2" tabIndex={-1}>Leitura</h2>
      {nicheLabel == null ? (
        <p className="cl-vazio">Escolha o nicho do canal para ver a leitura do nicho.</p>
      ) : (
        <>
          <div className="cl-ask">
            {/* aria-disabled (não `disabled`): o botão segue no foco e a frase abaixo o descreve. Sem onClick: nada é enviado. */}
            <button type="button" className="obs-ch-btn cl-ask-btn" aria-disabled="true" aria-describedby="cl-ask-p">Pedir leitura deste canal à forja</button>
            <p id="cl-ask-p">Leitura por canal ainda não existe. Por enquanto, a leitura do nicho {nicheLabel} está logo abaixo.</p>
          </div>
          <h3 className="cl-nicho">Leitura do nicho {nicheLabel} (não é só deste canal)</h3>
          <div className="cl-card">{children}</div>
        </>
      )}
    </section>
  )
}
