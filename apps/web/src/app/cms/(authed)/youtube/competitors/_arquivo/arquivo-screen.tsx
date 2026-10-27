import type { ReactElement } from 'react'
import type { ModeloPagina } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import type { LeituraBloco } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { FraseComForma } from './regua'
import { CartaoDoTipoView } from './cartao-do-tipo'
import { BlocoCanaisRemovidosView, BlocoNaoLido } from './bloco-canais-removidos'
import { Legenda } from './legenda'
import { GrupoTeste } from './grupo-teste'

/** A página Arquivo (M5, 04 §14.2): só leitura. Ordem do mockup: resumo, legenda, bloco (acima dos tipos só se pede algo), problemas, tipos, meses à frente, dado de teste. */
export function ArquivoScreen({ modelo, bloco, acesso }: { modelo: ModeloPagina; bloco: LeituraBloco; acesso: 'edita' | 'administra' }): ReactElement {
  const administra = acesso === 'administra'
  const blocoNode = bloco.ok ? <BlocoCanaisRemovidosView bloco={bloco.bloco} /> : <BlocoNaoLido />
  const blocoSobe = bloco.ok && bloco.bloco.acimaDosTipos
  return (
    <div data-obs-screen="arquivo" className="arq-tela">
      <h2 className="arq-h2">Arquivo</h2>
      <p className={`arq-resumo-geral${modelo.resumo.forma === 'visto' || modelo.resumo.forma === 'pontilhado' ? ' calmo' : ''}`}><FraseComForma forma={modelo.resumo.forma}>{modelo.resumo.texto}</FraseComForma></p>
      {modelo.ligado ? (
        <>
          {!administra ? <p className="arq-nota">Alguns passos esperam quem administra o site.</p> : null}
          {modelo.casa.frase && modelo.casa.frase !== modelo.resumo.texto ? <p className="arq-casa"><FraseComForma forma={modelo.casa.forma}>{modelo.casa.frase}</FraseComForma></p> : null}
          <Legenda />
          {blocoSobe ? blocoNode : null}
          {modelo.problemas.length > 0 ? (
            <section className="arq-card arq-problemas" aria-label="Problemas" data-secao="problemas">
              <header className="arq-card-h"><h3 className="arq-h3">Problemas</h3></header>
              <ul className="arq-rows">{modelo.problemas.map((p, i) => <li key={i} className="arq-mes arq-prob"><FraseComForma forma={p.forma}>{p.frase}</FraseComForma></li>)}</ul>
            </section>
          ) : null}
          {modelo.tipos.map(t => <CartaoDoTipoView key={t.tipo} cartao={t} />)}
          {!blocoSobe ? blocoNode : null}
          {modelo.mesesAFrente.length > 0 ? (
            <section className="arq-card" aria-label="Meses criados à frente" data-secao="meses-a-frente">
              <header className="arq-card-h"><h3 className="arq-h3">Meses criados à frente</h3></header>
              <ul className="arq-rows">{modelo.mesesAFrente.map(m => <li key={m.tabela} className="arq-mes arq-prob"><span className="arq-mn">{m.tabela}</span><FraseComForma forma={m.forma}>{m.frase}</FraseComForma></li>)}</ul>
            </section>
          ) : null}
          {administra && modelo.teste ? <GrupoTeste teste={modelo.teste} /> : null}
        </>
      ) : null}
    </div>
  )
}
