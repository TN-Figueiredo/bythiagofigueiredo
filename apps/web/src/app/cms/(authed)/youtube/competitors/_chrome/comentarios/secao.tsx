// A5 · E5a · Tarefa C2: a seção montada a partir de `SecaoView` (componente de servidor; sem estado próprio).
// O dado do leitor NÃO passa pelo `HistoricoView`: a página (C3) chama o modelo e entrega o `SecaoView` aqui.
import type { CriadorDoFio } from './fio-model'
import { InfoDica } from '../../_proprio/info-dica'
import { Abas } from './abas'
import { EstadoDoPainel } from './estados'
import { enxugarLista } from './enxuto'
import { ListaDoPainel } from './lista'
import { ResumoDaLista } from './resumo'
import { MARCOS_DA_TELA, type PainelView, type SecaoView } from './model'
import './comentarios.css'
import './fio.css'

function Painel({ v, criador, hrefFilaSaiu }: { v: PainelView; criador: CriadorDoFio; hrefFilaSaiu?: string }) {
  return v.kind === 'lista' ? <ListaDoPainel v={enxugarLista(v)} criador={criador} hrefFilaSaiu={hrefFilaSaiu} /> : <EstadoDoPainel v={v} />
}

export function SecaoDeComentarios({ v, criador, hrefFilaSaiu }: { v: SecaoView; criador: CriadorDoFio; hrefFilaSaiu?: string }) {
  return (
    <section className="cd-secao cf-cq" aria-labelledby="cd-titulo">
      <h2 id="cd-titulo" className="cd-titulo">{v.titulo}</h2>
      <InfoDica titulo={v.info.titulo} rotulo={v.info.rotulo} paragrafos={v.info.paragrafos} />
      {v.faixa ? <p className="cd-faixa">{v.faixa}</p> : null}
      <Abas abas={v.abas} abertaInicial={v.aberta} cima={MARCOS_DA_TELA.map(m => { const p = v.paineis[m]; return p.kind === 'lista' ? <ResumoDaLista v={p} /> : null })}>
        {MARCOS_DA_TELA.map(m => <Painel key={m} v={v.paineis[m]} criador={criador} hrefFilaSaiu={hrefFilaSaiu} />)}
      </Abas>
      <p className="cd-nota">{v.fonte}</p>
    </section>
  )
}
