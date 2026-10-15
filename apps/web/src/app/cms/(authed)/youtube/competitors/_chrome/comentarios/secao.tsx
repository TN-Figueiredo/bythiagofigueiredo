// A5 · E5a · Tarefa C2: a seção montada a partir de `SecaoView` (componente de servidor; sem estado próprio).
// O dado do leitor NÃO passa pelo `HistoricoView`: a página (C3) chama o modelo e entrega o `SecaoView` aqui.
import { InfoDica } from '../../_proprio/info-dica'
import { Abas } from './abas'
import { EstadoDoPainel } from './estados'
import { ListaDoPainel } from './lista'
import { MARCOS_DA_TELA, type PainelView, type SecaoView } from './model'
import './comentarios.css'

function Painel({ v, hrefFilaSaiu }: { v: PainelView; hrefFilaSaiu?: string }) {
  return v.kind === 'lista' ? <ListaDoPainel v={v} hrefFilaSaiu={hrefFilaSaiu} /> : <EstadoDoPainel v={v} />
}

export function SecaoDeComentarios({ v, hrefFilaSaiu }: { v: SecaoView; hrefFilaSaiu?: string }) {
  return (
    <section className="cd-secao" aria-labelledby="cd-titulo">
      <h2 id="cd-titulo" className="cd-titulo">{v.titulo}</h2>
      <InfoDica titulo={v.info.titulo} rotulo={v.info.rotulo} paragrafos={v.info.paragrafos} />
      {v.faixa ? <p className="cd-faixa">{v.faixa}</p> : null}
      <Abas abas={v.abas} abertaInicial={v.aberta}>
        {MARCOS_DA_TELA.map(m => <Painel key={m} v={v.paineis[m]} hrefFilaSaiu={hrefFilaSaiu} />)}
      </Abas>
      <p className="cd-nota">{v.fonte}</p>
    </section>
  )
}
