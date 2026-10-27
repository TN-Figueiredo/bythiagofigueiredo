import type { ReactElement, ReactNode } from 'react'
import type { ModeloPagina, Topo } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
import type { LeituraBloco } from '@/lib/youtube/observatorio/arquivo-mensal/canais-removidos'
import { FraseComForma } from './regua'
import { CartaoDoTipoView } from './cartao-do-tipo'
import { BlocoCanaisRemovidosView, BlocoNaoLido } from './bloco-canais-removidos'
import { Legenda } from './legenda'
import { GrupoTeste } from './grupo-teste'

/** Quem só edita não pode agir: "precisa de você" vira "precisa de quem administra o site" (Logan A5). */
const paraQuemEdita = (s: string): string => s.replace(/(precisam?) de você/g, '$1 de quem administra o site')

/** A frase do topo com os links para a linha do mês, o bloco ou a lista (Logan A1). */
function FraseDoTopo({ topo, administra }: { topo: Topo; administra: boolean }): ReactNode {
  const ajusta = administra ? (s: string): string => s : paraQuemEdita
  if (!topo.partes) return ajusta(topo.texto)
  return topo.partes.map((p, i) => (typeof p === 'string' ? <span key={i}>{ajusta(p)}</span> : <a key={i} href={`#${p.ancora}`}>{p.texto}</a>))
}

/** A página Arquivo (M5, 04 §14.2): só leitura. Ordem (Logan A1b): resumo, "Além disso", casa, problemas, legenda, bloco (acima dos tipos só se pede algo), tipos, meses à frente, dado de teste. */
export function ArquivoScreen({ modelo, bloco, acesso }: { modelo: ModeloPagina; bloco: LeituraBloco; acesso: 'edita' | 'administra' }): ReactElement {
  const administra = acesso === 'administra'
  const blocoNode = bloco.ok ? <BlocoCanaisRemovidosView bloco={bloco.bloco} /> : <BlocoNaoLido />
  const blocoSobe = bloco.ok && bloco.bloco.acimaDosTipos
  const naoLido = modelo.resumo.forma === 'hachura'
  return (
    <div data-obs-screen="arquivo" className="arq-tela">
      <h2 className="arq-h2">Arquivo</h2>
      {naoLido ? (
        <p className="arq-ausente nm" data-forma="hachura"><span className="arq-hach" aria-hidden="true" /><span>{modelo.resumo.texto}</span></p>
      ) : (
        <p className={`arq-resumo-geral${modelo.resumo.forma === 'visto' || modelo.resumo.forma === 'pontilhado' ? ' calmo' : ''}`}><FraseComForma forma={modelo.resumo.forma}><FraseDoTopo topo={modelo.resumo} administra={administra} /></FraseComForma></p>
      )}
      {modelo.ligado ? (
        <>
          {modelo.alem ? <p className="arq-alem"><FraseComForma forma={modelo.alem.forma}><span>Além disso: </span><FraseDoTopo topo={modelo.alem} administra={administra} /></FraseComForma></p> : null}
          {modelo.casa.frase && modelo.casa.frase !== modelo.resumo.texto ? <p className="arq-casa"><FraseComForma forma={modelo.casa.forma}>{modelo.casa.frase}</FraseComForma></p> : null}
          {modelo.problemas.length > 0 ? (
            <section id="problemas" className="arq-card arq-problemas" aria-label="Problemas" data-secao="problemas">
              <header className="arq-card-h"><h3 className="arq-h3">Problemas</h3></header>
              <ul className="arq-rows">{modelo.problemas.map((p, i) => <li key={i} className="arq-mes arq-prob"><FraseComForma forma={p.forma}>{p.frase}</FraseComForma>{p.ancora ? <a href={`#${p.ancora}`}>ver</a> : null}</li>)}</ul>
            </section>
          ) : null}
          <Legenda />
          {blocoSobe ? blocoNode : null}
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
