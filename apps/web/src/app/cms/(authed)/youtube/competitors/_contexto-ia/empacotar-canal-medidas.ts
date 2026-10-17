/**
 * A5 · E17 degrau 1, TG: os blocos de medida da página do canal do concorrente no pacote "Perguntar a uma IA" (estado e frase do topo, células de
 * medida, Direção, Ritmo, Lançamentos e Horas, Linha do tempo). Puro. `projetarMedidas` junta os MESMOS modelos que a página usa (`derivar`,
 * `fraseDoTopo`, `celulasDoCabecalho`, `blocoDeDirecao`...: nenhuma conta nova) e deixa só texto, como a tela o escreve; as tabelas saem daí.
 * Dado ausente sai como "não medido"/"não carregou" com o motivo da tela, nunca como 0.
 */
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { Inventario } from '@/lib/youtube/observatorio/contexto-ia/inventario'
import type { Celula, Tabela } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { A_TELA_NAO_INFORMA_O_MOTIVO } from '@/lib/youtube/observatorio/contexto-ia/frases'
import { derivar, entradaDaFrase, type ContextoDoCanal } from '../_canal/medidas/canal-derivado'
import { celulasDoCabecalho } from '../_canal/medidas/cabecalho-model'
import { COM_FAIXA } from '../_canal/medidas/estado-model'
import { fraseDoTopo } from '../_canal/medidas/frase-do-topo'
import { dm } from '../_canal/medidas/formatos'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'

// ───────────────────────── a projeção: só texto, na ordem da tela
export interface CelulaDeMedidaIa {
  chave: string
  rotulo: string
  /** O texto do valor como a célula o mostra; nulo = não medido ou não carregou (o `motivo` diz por quê). */
  valor: string | null
  zero: boolean
  motivo: string | null
  base: string
  aviso: string | null
}

export interface MedidasIa {
  topo: { faixa: string | null; frase: string }
  celulas: CelulaDeMedidaIa[]
}

const UNIDADE: Record<string, string> = { ritmo: ' (por semana)' }

export function projetarMedidas(c: CanalInteiro, ctx: ContextoDoCanal): MedidasIa {
  const d = derivar(ctx, c)
  const frase = fraseDoTopo(entradaDaFrase(ctx, d))
  const celulas = celulasDoCabecalho({
    F: ctx.F, subs: ctx.subs, medidas: d.medidas, formato: d.formato, estado: d.estado, extras: { missingSince: null },
    semVideos: ctx.semVideos, hojeSP: ctx.hojeSP,
    // PENDENTE: a célula "Criador responde" entra com o bloco do criador (leitura dos comentários)
  }).filter((x) => x.chave !== 'inscritos' && x.chave !== 'criador')
  return {
    topo: { faixa: COM_FAIXA.has(d.estado.tipo) ? d.estado.pastilha : null, frase: frase.texto },
    celulas: celulas.map((x): CelulaDeMedidaIa => {
      const det = x.detalhe
      let valor: string | null = null
      if (x.valor === 'medido' || x.valor === 'zero') {
        if (det.chave === 'direcao' && det.direcao.tipo === 'medido') valor = det.direcao.texto
        else if (det.chave === 'estado') valor = det.estado.pastilha
        else if (det.chave === 'acerto') valor = `${det.k} de ${det.n}${det.pct === null ? '' : ` (${det.pct}%)`}`
        else if (det.chave === 'ritmo') valor = det.porSemana
      }
      return {
        chave: x.chave, rotulo: x.rotulo + (UNIDADE[x.chave] ?? ''), valor, zero: x.valor === 'zero', motivo: valor === null ? x.motivo : null, base: x.base,
        // a mesma frase que a célula escreve (a data é a da mudança de contagem, não a do aviso)
        aviso: det.chave === 'direcao' && det.avisoAte ? `ainda cruza a mudança de ${dm(MEASURE_RULES.countChange)}` : null,
      }
    }),
  }
}

// ───────────────────────── o inventário das folhas (prefixo `derivado.medidas.`)
const ID = { descartado: 'identificador' } as const
const CTRL = { descartado: 'controle de tela' } as const

export const INVENTARIO_MEDIDAS_CANAL: Inventario = {
  'derivado.medidas.topo.faixa': 'base', 'derivado.medidas.topo.frase': 'base',
  'derivado.medidas.celulas[].chave': ID, 'derivado.medidas.celulas[].rotulo': 'rotulo', 'derivado.medidas.celulas[].valor': 'numero',
  'derivado.medidas.celulas[].zero': CTRL, 'derivado.medidas.celulas[].motivo': 'motivo', 'derivado.medidas.celulas[].base': 'base', 'derivado.medidas.celulas[].aviso': 'base',
}

// ───────────────────────── células
const O = 'modelo.derivado.medidas'
const rotulo = (texto: string, origem: string): Celula => ({ papel: 'rotulo', texto, origem })
const base = (texto: string, origem: string): Celula => ({ papel: 'base', texto, origem })
const medido = (texto: string, origem: string, zero = false): Celula => (zero ? { papel: 'numero', estado: 'zero_medido', texto, x: 0, origem } : { papel: 'numero', estado: 'medido', texto, x: null, origem })
const naoMedido = (motivo: string | null, origem: string): Celula => ({ papel: 'numero', estado: 'nao_medido', motivo: motivo ?? A_TELA_NAO_INFORMA_O_MOTIVO, origem })

const tabelaFixa = (id: string, titulo: string, nomeNoCorte: string, colunas: string[], linhas: Celula[][]): Tabela => ({ id, titulo, tipo: 'fixa', nomeNoCorte, privada: false, colunas, linhas })

/** As tabelas e os avisos dos blocos de medida; vazio quando as medidas não foram pedidas ao empacotador. */
export function tabelasDeMedidas(m: MedidasIa | null): { tabelas: Tabela[]; avisos: string[] } {
  if (m === null) return { tabelas: [], avisos: [] }
  const tabelas: Tabela[] = []
  if (m.celulas.length) {
    tabelas.push(tabelaFixa('canal-medidas-celulas', 'Direção, estado, acerto e ritmo do canal', 'direção, estado, acerto e ritmo', ['Medida', 'Valor', 'Base'],
      m.celulas.map((c, i) => [
        rotulo(c.rotulo, `${O}.celulas[${i}].rotulo`),
        c.valor !== null ? medido(c.valor, `${O}.celulas[${i}].valor`, c.zero) : naoMedido(c.motivo, `${O}.celulas[${i}].motivo`),
        base(c.base, `${O}.celulas[${i}].base`),
      ])))
    const avisos = m.celulas.flatMap((c, i) => (c.aviso ? [[i, c.aviso] as const] : []))
    if (avisos.length) {
      tabelas.push(tabelaFixa('canal-medidas-avisos', 'Avisos das medidas do canal', 'avisos das medidas', ['Medida', 'Aviso'],
        avisos.map(([i, a]) => [rotulo(m.celulas[i]!.rotulo, `${O}.celulas[${i}].rotulo`), base(a, `${O}.celulas[${i}].aviso`)])))
    }
  }
  return { tabelas, avisos: [...(m.topo.faixa ? [m.topo.faixa] : []), m.topo.frase] }
}
