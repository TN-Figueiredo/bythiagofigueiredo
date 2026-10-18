// Comentários em produção · I3 (Yannis): o que cruza a fronteira servidor→cliente. O `CartaoView` inteiro carrega o texto de terceiros duas vezes
// (nos campos antigos, que o pacote da IA lê, e em `fio`); o cliente só desenha `fio` mais o que está em `ExtraView`.
import type { FioView } from './fio-model'
import type { CartaoView, ListaView } from './model'

export interface ExtraView {
  cortado: boolean; temEndereco: boolean; semResposta: string | null
  base: CartaoView['base']; saiu: string | null
}
export interface CartaoEnxuto { id: string; fio: FioView; extra: ExtraView }
export type ListaEnxuta = Omit<ListaView, 'cartoes' | 'saidos'> & { cartoes: CartaoEnxuto[]; saidos: CartaoEnxuto[] }

export function enxugarCartao(c: CartaoView): CartaoEnxuto {
  const r = c.resposta
  return {
    id: c.id,
    fio: c.fio,
    extra: {
      cortado: c.texto?.cortado ?? false,
      temEndereco: c.texto?.temEndereco ?? false,
      semResposta: r && r.forma !== 'respondeu' ? r.texto : null,
      base: c.base,
      saiu: c.saiu,
    },
  }
}

export function enxugarLista(v: ListaView): ListaEnxuta {
  return { ...v, cartoes: v.cartoes.map(enxugarCartao), saidos: v.saidos.map(enxugarCartao) }
}
