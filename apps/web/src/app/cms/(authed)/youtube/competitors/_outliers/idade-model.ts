/**
 * A5 E5a, Tarefa 8 (mockup 17b): as views dos outliers aos 7 e aos 30 dias. Módulo PURO: nenhuma consulta, nenhum relógio (o dia de hoje entra por
 * parâmetro). Cada célula é uma de três formas que nunca se confundem: medido (o zero é medido, com valor 0), não medido (com o motivo) e não carregou.
 */
import { classeDoMotivo, FRASES } from '@/lib/youtube/observatorio/medidas-telas/frases'
import { INICIO_DAS_MARCAS } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import type { ValorM1 } from '@/lib/youtube/observatorio/medidas/m1'
import type { Medida, MotivoNaoMedido } from '@/lib/youtube/observatorio/medidas/tipos'

export type Idade = 7 | 30
export const IDADES: readonly Idade[] = [7, 30]

/** Os quatro motivos que o mockup nomeia, na ordem em que a tela os conta; o resto cai em `outros` com a frase curta da tabela única. */
export type GrupoDeMotivo = 'antes' | 'fecha' | 'tarde' | 'distantes' | 'outros'

export type Celula =
  | { estado: 'medido'; valor: number }
  | { estado: 'nao_medido'; grupo: GrupoDeMotivo; motivo: MotivoNaoMedido; curta: string; longa: string; fechaEm: string | null }
  | { estado: 'nao_carregou' }

/** 'AAAA-MM-DD' vira 'dd/mm'. */
export const dm = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`

const MS_DIA = 86_400_000
/** Dias inteiros de `de` até `ate` (ambos 'AAAA-MM-DD'). */
export const diasEntre = (de: string, ate: string): number => Math.round((Date.parse(ate + 'T00:00:00Z') - Date.parse(de + 'T00:00:00Z')) / MS_DIA)

const GRUPO: Partial<Record<MotivoNaoMedido, GrupoDeMotivo>> = {
  leitura_comecou_depois: 'antes', fecha_em: 'fecha', descoberto_tarde: 'tarde', leituras_distantes: 'distantes',
}

/** A frase de um motivo nesta tela. As quatro curtas do mockup 17b são deste arquivo; as demais vêm da tabela única. */
function fraseDoMotivo(motivo: MotivoNaoMedido, idade: Idade, m: Extract<Medida<ValorM1>, { estado: 'nao_medido' }>): { curta: string; longa: string } {
  const base = FRASES[motivo]({ fechaEm: m.fechaEm, desde: m.desde, idade }, 'outliers')
  switch (motivo) {
    case 'leitura_comecou_depois': return { curta: `antes de ${dm(INICIO_DAS_MARCAS)}`, longa: `a contagem diária começou em ${dm(INICIO_DAS_MARCAS)}` }
    case 'descoberto_tarde': return { curta: 'descoberto tarde', longa: 'descobrimos o vídeo mais de 24 horas depois de publicado' }
    case 'leituras_distantes': return { curta: 'leituras distantes', longa: 'as leituras vizinhas ficam a mais de 36 horas da idade' }
    case 'fecha_em':
      return m.fechaEm
        ? { curta: `fecha em ${dm(m.fechaEm)}`, longa: `o vídeo ainda não tem ${idade} dias; a medida fecha em ${dm(m.fechaEm)}` }
        : base
    default: return base
  }
}

/** A célula de um vídeo numa idade. `m1` ausente (o canal não carregou) ou 'erro' é "não carregou", nunca "não medido" e nunca zero. */
export function celulaDeIdade(m1: Medida<ValorM1> | undefined | null, idade: Idade): Celula {
  if (!m1) return { estado: 'nao_carregou' }
  if (m1.estado === 'medido') {
    const v = m1.valor.views
    return Number.isFinite(v) && v >= 0 ? { estado: 'medido', valor: v } : { estado: 'nao_carregou' }
  }
  if (classeDoMotivo(m1.motivo) === 'nao_carregou') return { estado: 'nao_carregou' }
  const f = fraseDoMotivo(m1.motivo, idade, m1)
  return { estado: 'nao_medido', grupo: GRUPO[m1.motivo] ?? 'outros', motivo: m1.motivo, curta: f.curta, longa: f.longa, fechaEm: m1.fechaEm ?? null }
}

export interface ItemDeIdade { id: string; celula: Celula }

/**
 * Os medidos (inclusive zero) por valor decrescente; depois os não medidos e os que não carregaram, na ordem em que vieram (a do multiplicador).
 * A ordenação é estável: empate de valor mantém a ordem do multiplicador.
 */
export function ordenarPorIdade<T extends ItemDeIdade>(itens: readonly T[]): { medidos: T[]; resto: T[] } {
  const medidos = itens.filter(i => i.celula.estado === 'medido')
    .map((i, k) => ({ i, k })).sort((a, b) => (b.i.celula as { valor: number }).valor - (a.i.celula as { valor: number }).valor || a.k - b.k).map(x => x.i)
  const resto = itens.filter(i => i.celula.estado !== 'medido')
  return { medidos, resto }
}

export type CasaDeCobertura = 'cheia' | 'zero' | 'nao' | 'erro'
export interface Cobertura { medidos: number; total: number; zeros: number; erros: number; casas: CasaDeCobertura[] }

/** A contagem "N de M" é da lista inteira (não da página). Uma casa por vídeo, na ordem recebida. */
export function cobertura(celulas: readonly Celula[]): Cobertura {
  const casas: CasaDeCobertura[] = celulas.map(c => (c.estado === 'medido' ? (c.valor === 0 ? 'zero' : 'cheia') : c.estado === 'nao_carregou' ? 'erro' : 'nao'))
  return { medidos: celulas.filter(c => c.estado === 'medido').length, total: celulas.length, zeros: casas.filter(c => c === 'zero').length, erros: casas.filter(c => c === 'erro').length, casas }
}

export interface MotivoAgrupado { grupo: GrupoDeMotivo; n: number; texto: string }

const plural = (n: number, um: string, varios: string): string => (n === 1 ? um : varios)

/** Motivos dos não medidos, com contagem e data, na ordem do NOTAS: antes de 03/10, fecham em, descoberto tarde, leituras distantes, outros. */
export function motivosAgrupados(celulas: readonly Celula[]): MotivoAgrupado[] {
  const naoMedidos = celulas.filter((c): c is Extract<Celula, { estado: 'nao_medido' }> => c.estado === 'nao_medido')
  const out: MotivoAgrupado[] = []
  const antes = naoMedidos.filter(c => c.grupo === 'antes').length
  if (antes) out.push({ grupo: 'antes', n: antes, texto: `${antes} antes de ${dm(INICIO_DAS_MARCAS)}` })
  const datas = naoMedidos.filter(c => c.grupo === 'fecha' && c.fechaEm).map(c => c.fechaEm as string).sort()
  const semData = naoMedidos.filter(c => c.grupo === 'fecha' && !c.fechaEm).length
  if (datas.length) {
    const u = [...new Set(datas)]
    const quando = datas.length === 1 ? `fecha em ${dm(u[0]!)}` : u.length === 1 ? `fecham em ${dm(u[0]!)}` : u.length === 2 ? `fecham em ${dm(u[0]!)} e ${dm(u[1]!)}` : `fecham de ${dm(u[0]!)} a ${dm(u[u.length - 1]!)}`
    out.push({ grupo: 'fecha', n: datas.length, texto: `${datas.length} ${quando}` })
  }
  if (semData) out.push({ grupo: 'fecha', n: semData, texto: `${semData} ainda sem data para fechar` })
  const tarde = naoMedidos.filter(c => c.grupo === 'tarde').length
  if (tarde) out.push({ grupo: 'tarde', n: tarde, texto: `${tarde} ${plural(tarde, 'descoberto', 'descobertos')} tarde` })
  const dist = naoMedidos.filter(c => c.grupo === 'distantes').length
  if (dist) out.push({ grupo: 'distantes', n: dist, texto: `${dist} com ${plural(dist, 'leitura distante', 'leituras distantes')}` })
  const outros = naoMedidos.filter(c => c.grupo === 'outros').length
  if (outros) out.push({ grupo: 'outros', n: outros, texto: `${outros} ${plural(outros, 'sem a medida por outro motivo', 'sem a medida por outros motivos')}` })
  return out
}

export interface QuandoFecham { datas: string[]; primeira: string; ultima: string; faltam: number }

/** A régua "Quando fecham": só existe se alguém ainda fecha (data de fechamento de hoje em diante). */
export function quandoFecham(celulas: readonly Celula[], hojeSP: string): QuandoFecham | null {
  const datas = celulas.flatMap(c => (c.estado === 'nao_medido' && c.fechaEm && c.fechaEm >= hojeSP ? [c.fechaEm] : [])).sort()
  if (!datas.length) return null
  return { datas, primeira: datas[0]!, ultima: datas[datas.length - 1]!, faltam: diasEntre(hojeSP, datas[0]!) }
}

export interface FraseDaOrdem { medidos: number; total: number; zeros: number }

/**
 * A frase do topo quando a ordem é por idade. Texto do NOTAS: singular e plural, zero medido, e o caso de nenhum medido (a lista segue o
 * multiplicador e a frase diz quando fecha a primeira). Cada trecho é `{ b }` (negrito) ou texto.
 */
export function fraseDaOrdem(idade: Idade, f: FraseDaOrdem, primeira: QuandoFecham | null): Array<string | { b: string }> {
  const nome = `views aos ${idade} dias`
  const { medidos, total, zeros } = f
  if (!medidos) {
    const quando = primeira
      ? ['a primeira medida fecha em ', { b: dm(primeira.primeira) }, primeira.faltam === 1 ? ' (falta 1 dia)' : ` (faltam ${primeira.faltam} dias)`] as Array<string | { b: string }>
      : ['nenhuma vai fechar']
    return [{ b: 'Nenhum' }, (total === 1 ? ` do único outlier tem ${nome} ainda: ` : ` dos ${total} outliers tem ${nome} ainda: `), ...quando, '. Enquanto isso, a lista segue o multiplicador.']
  }
  const sem = total - medidos
  const out: Array<string | { b: string }> = [`Do maior para o menor número de ${nome}: `, { b: `${medidos} de ${total}` }, ` ${plural(total, 'outlier', 'outliers')} ${plural(medidos, 'já tem', 'já têm')} essa medida`]
  if (zeros) out.push(' (', `${zeros} com `, { b: 'zero medido' }, ')')
  if (sem) out.push(`; ${plural(sem, 'o outro ', 'os outros ')}`, { b: String(sem) }, ` ${plural(sem, 'fica', 'ficam')} no fim, na ordem do multiplicador`)
  out.push('.')
  return out
}
