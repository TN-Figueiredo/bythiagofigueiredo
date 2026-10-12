/**
 * A régua do nicho de UMA linha do par (spec 18.5). Pura: monta `vals` com os canais do conjunto do par (o nicho, quando os dois
 * são do mesmo nicho; senão todos) que têm o número medido, e as marcas A e B. Nulo, NaN ou infinito NUNCA entra em `vals` (`buildRegua`
 * lança com valor não finito): o lado vira "sem traço" com o motivo do "não medido", não uma exceção na tela inteira.
 * A posição escrita ao lado do valor é a da régua (`ReguaView.posicao`): a posição escrita e a desenhada vêm de UMA conta, e um teste
 * confirma que ela coincide com `ParView.linhas[].pos` em todos os pares do fixture.
 */
import { conjuntoTexto } from '@/lib/youtube/observatorio/posicao'
import { buildRegua, type ReguaView, type MarcaRegua, type ValorRegua } from '../_chrome/regua/regua-model'
import type { NumeroId } from './numeros-model'
import type { CompararPack } from './pack'
import type { ParView } from './par-model'

/** Como a régua fala de cada número ("inscritos"; a unidade da fala, vazia quando o valor escrito já a traz). */
const FALA: Partial<Record<NumeroId, { numero: string; un: string }>> = {
  inscritos: { numero: 'inscritos', un: 'inscritos' },
  longosAcomp: { numero: 'longos acompanhados', un: 'longos' },
  longos90: { numero: 'longos publicados em 90 dias', un: 'longos' },
  medianaViews: { numero: 'mediana de views dos longos', un: 'views' },
  vpd: { numero: 'views por dia nos longos', un: 'views por dia' },
  vpdPorMil: { numero: 'views por dia por mil inscritos', un: 'views por dia por mil inscritos' },
}

export function reguaDaLinha(pack: CompararPack, par: ParView, id: NumeroId): ReguaView | null {
  const fala = FALA[id]
  if (!fala) return null
  const c = par.conjunto
  const canais = c.tipo === 'nicho' ? pack.canais.filter(x => x.niche === c.niche) : pack.canais
  const vals: ValorRegua[] = []
  for (const x of canais) {
    const n = x.numeros[id]
    if (n.x != null && Number.isFinite(n.x)) vals.push({ id: x.id, nome: x.name, x: n.x, texto: n.texto && n.texto.trim() ? n.texto : String(n.x) })
  }
  const marca = (letra: 'A' | 'B', lado: ParView['a']): MarcaRegua => ({
    id: lado.id, letra, nome: lado.name, motivo: lado.numeros[id].motivo ?? 'não foi possível calcular este número agora; recarregue a página',
  })
  return buildRegua(vals, [marca('A', par.a), marca('B', par.b)], { numero: fala.numero, conjunto: conjuntoTexto(c), un: fala.un })
}
