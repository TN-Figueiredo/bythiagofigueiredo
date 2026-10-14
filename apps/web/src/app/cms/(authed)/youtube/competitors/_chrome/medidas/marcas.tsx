'use client'
/** A5 · E5a, Tarefa 3: as quatro formas da seção 4.2 do plano. Uma não se confunde com a outra: zero medido, não medido, ainda não existe, não carregou. */
import './medidas.css'

/** O dia foi lido e o número é 0: caixa vazada. É o único componente deste arquivo que escreve o algarismo 0. */
export function ZeroMedido() {
  return <span className="obs-ch-zero">0</span>
}

/** Não medido: a hachura é a forma, a frase curta vai dentro e a longa fica para o leitor de tela. Só a pastilha usa a classe, nunca um contêiner. */
export function NaoMedido({ curta, longa }: { curta: string; longa: string }) {
  return (
    <span className="obs-ch-nm" title={longa}>
      {curta}
      <span className="obs-md-sr">: {longa}</span>
    </span>
  )
}

const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** A leitura ainda não existe: a data é obrigatória (sem ela a tela inventaria uma promessa). */
export function AindaNaoExiste({ existeEm }: { existeEm: string }) {
  if (!existeEm) throw new Error('ainda_nao_existe_sem_data')
  // TEXTO-A-REVISAR (Logan/Naksu): a frase curta de "ainda não existe" não está fixada no plano.
  return <span className="obs-md-ainda">só a partir de {dm(existeEm)}</span>
}

/** "Não carregou" é falha, nunca "não medido" nem zero. O botão só existe quando quem chama dá a função. */
export function NaoCarregou({ onTentar }: { onTentar?: () => void }) {
  // TEXTO-A-REVISAR (Logan/Naksu): os textos de "não carregou" não estão fixados no plano.
  return (
    <span className="obs-md-nc" role="alert">
      <span>Não carregou</span>
      {onTentar ? <button type="button" onClick={onTentar}>Tentar de novo</button> : null}
    </span>
  )
}
