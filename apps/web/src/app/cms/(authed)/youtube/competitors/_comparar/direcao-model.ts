/**
 * A5 E5a T7 (tela 17a): o grupo "Direção" da comparação. Uma leitura principal e duas de apoio (M3 a, b, c), a mesma regra de cor e de
 * símbolo das três, a régua de direção por nicho e a frase de cada lado. PURO: o relógio é o `hojeSP` do pacote.
 *
 * - (c) só é a principal quando medida nos DOIS lados; medida num lado só, (a) continua principal nos dois (as linhas não podem ter
 *   leituras principais diferentes). Antes de `mesmaIdadeExisteEm()` (c) é "ainda não existe", com a data escrita uma vez.
 * - A contagem de longos publicados usa a mesma regra de ±10% das outras direções; é contagem, não frequência.
 */
import { mesmaIdadeExisteEm } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { posicaoNaRegua, type SimboloDeDirecao } from '@/lib/youtube/observatorio/medidas-telas/direcao-exibida'
import type { CanalPack, CompararPack } from './pack'
import { dm, medidasDoLado, type CelulaContagem, type CelulaDirecao, type LadoMedidas } from './medidas-do-lado'
import { relacaoDoPar, type RelacaoNova } from './relacao-do-par'

export type IdLeitura = 'a' | 'b' | 'c'
export const PALAVRA: Record<SimboloDeDirecao, string> = { sobe: 'subindo', desce: 'descendo', estavel: 'estável' }
const NOME_CURTO: Record<IdLeitura, string> = { a: 'canal inteiro', b: 'vídeos novos de hoje', c: 'vídeos novos na mesma idade' }

export interface MarcaDaRegua { letra: 'A' | 'B'; fracao: number; fora: 'acima' | 'abaixo' | null }
export interface ReguaDeDirecao {
  /** O nicho (só quando os dois lados são de nichos diferentes: aí há uma régua por lado). */
  nicho: string | null
  n: number
  /** Posição (0 a 1, de 5% a 95% da largura) dos traços dos outros canais do nicho. */
  tracos: number[]
  marcas: MarcaDaRegua[]
  semTraco: string[]
  alt: string
}

export interface LinhaDeDirecao {
  id: IdLeitura | 'pub'
  papel: 'principal' | 'apoio' | 'contagem'
  titulo: string
  sub: string
  lados: [CelulaDirecao | CelulaContagem, CelulaDirecao | CelulaContagem]
  /** Só na principal: uma régua (mesmo nicho) ou duas, uma por lado (nichos diferentes). */
  reguas: ReguaDeDirecao[]
  relacao: RelacaoNova | null
  /** Na leitura (c) antes da data: o que a coluna da diferença diz. */
  nota: string | null
}

export type ApoioDoLado =
  | { tipo: 'concordam' }
  | { tipo: 'em_parte'; detalhe: string }
  | { tipo: 'divergem'; detalhe: string }
  | { tipo: 'sem' }
export type FraseDoLado =
  | { tipo: 'erro'; nome: string }
  | { tipo: 'sem_direcao'; nome: string; porque: string }
  | { tipo: 'direcao'; nome: string; simbolo: SimboloDeDirecao; corpo: string; apoio: ApoioDoLado }

export interface GrupoDeDirecao {
  principal: 'a' | 'c'
  /** "canal inteiro, 17/10 a 13/11 contra 19/09 a 16/10" ou "vídeos novos na mesma idade, 90 dias contra 90". */
  leituraPrincipal: string
  linhas: LinhaDeDirecao[]
  frases: [FraseDoLado, FraseDoLado]
}

const medidaDe = (l: LadoMedidas, id: IdLeitura): CelulaDirecao => (id === 'a' ? l.a : id === 'b' ? l.b : l.c)

/** `AAAA-MM-DD` mais n dias, sem fuso. */
const soma = (dia: string, n: number): string => new Date(Date.parse(dia + 'T00:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)

function regua(
  pack: CompararPack, hojeSP: string, id: 'a' | 'c', lados: readonly LadoMedidas[], itens: ReadonlyArray<{ canal: CanalPack; letra: 'A' | 'B' }>, rotulo: boolean,
): ReguaDeDirecao {
  const nicho = itens[0]!.canal.niche
  const doNicho = pack.canais.filter(c => !c.own && c.niche === nicho)
  const valores: Array<{ id: string; v: number }> = []
  for (const c of doNicho) {
    const cel = medidaDe(medidasDoLado(c, hojeSP), id)
    if (cel.tipo === 'medido') valores.push({ id: c.id, v: cel.variacao })
  }
  const marcas: MarcaDaRegua[] = []
  const semTraco: string[] = []
  const alt: string[] = []
  for (const { canal, letra } of itens) {
    const cel = medidaDe(lados.find(l => l.id === canal.id)!, id)
    if (cel.tipo !== 'medido') { semTraco.push(canal.name); continue }
    const p = posicaoNaRegua(cel.pct, 60, cel.variacao)
    marcas.push({ letra, fracao: p.fracao, fora: p.foraDaEscala })
    if (!valores.some(x => x.id === canal.id)) valores.push({ id: canal.id, v: cel.variacao })
  }
  for (const { canal, letra } of itens) {
    const v = valores.find(x => x.id === canal.id)
    if (!v) continue
    const cel = medidaDe(lados.find(l => l.id === canal.id)!, id)
    const fora = cel.tipo === 'medido' ? posicaoNaRegua(cel.pct, 60, cel.variacao).foraDaEscala : null
    alt.push(`lado ${letra}, ${canal.name}: ${1 + valores.filter(x => x.v > v.v).length}º de ${valores.length}${fora && cel.tipo === 'medido' ? ` (fora da escala, ${cel.texto})` : ''}`)
  }
  const ids = new Set(itens.map(x => x.canal.id))
  const tracos = valores.filter(x => !ids.has(x.id)).map(x => posicaoNaRegua(0, 60, x.v).fracao)
  return {
    nicho: rotulo ? itens[0]!.canal.nicheLabel ?? nicho : null, n: valores.length, tracos, marcas, semTraco,
    alt: `Direção, de 60% abaixo a 60% acima, um traço por canal${rotulo ? ` do nicho ${itens[0]!.canal.nicheLabel ?? nicho}` : ''}. ${alt.join('; ')}.`,
  }
}

function fraseDoLado(l: LadoMedidas, nome: string, principal: 'a' | 'c'): FraseDoLado {
  if (l.naoCarregou) return { tipo: 'erro', nome }
  const p = medidaDe(l, principal)
  if (p.tipo !== 'medido') {
    const porque = p.tipo === 'nao_medido' || p.tipo === 'canal_proprio' ? p.porque : p.tipo === 'nao_carregou' ? 'a leitura dos números falhou' : 'ainda não existe'
    return { tipo: 'sem_direcao', nome, porque }
  }
  const corpo = principal === 'a' ? `${p.texto} de views no canal inteiro, 28 dias contra 28` : `${p.texto} de views aos 30 dias nos vídeos novos, 90 dias contra 90`
  const outros = (['a', 'b', 'c'] as const).filter(i => i !== principal).map(i => ({ i, c: medidaDe(l, i) })).flatMap(x => (x.c.tipo === 'medido' ? [{ i: x.i, c: x.c }] : []))
  let apoio: ApoioDoLado
  if (!outros.length) apoio = { tipo: 'sem' }
  else if (outros.every(x => x.c.simbolo === p.simbolo)) apoio = { tipo: 'concordam' }
  else {
    const longe = outros.filter(x => x.c.simbolo !== p.simbolo)
    const perto = longe.every(x => Math.abs(x.c.variacao - p.variacao) < 0.1)
    const detalhe = longe.map(x => `${NOME_CURTO[x.i]}: ${PALAVRA[x.c.simbolo]}`).join('; ') + (longe.some(x => x.c.simbolo === 'desce') ? '; pode ser só idade' : '')
    apoio = perto ? { tipo: 'em_parte', detalhe } : { tipo: 'divergem', detalhe }
  }
  return { tipo: 'direcao', nome, simbolo: p.simbolo, corpo, apoio }
}

export function grupoDeDirecao(pack: CompararPack, hojeSP: string, canais: readonly [CanalPack, CanalPack], lados: readonly [LadoMedidas, LadoMedidas]): GrupoDeDirecao {
  const [la, lb] = lados
  const principal: 'a' | 'c' = la.c.tipo === 'medido' && lb.c.tipo === 'medido' ? 'c' : 'a'
  const apoios = (['a', 'b', 'c'] as const).filter(i => i !== principal)
  const nichosDiferentes = canais[0].niche !== canais[1].niche
  const nomes: readonly [string, string] = [canais[0].name, canais[1].name]

  const reguas: ReguaDeDirecao[] = nichosDiferentes
    ? [regua(pack, hojeSP, principal, lados, [{ canal: canais[0], letra: 'A' }], true), regua(pack, hojeSP, principal, lados, [{ canal: canais[1], letra: 'B' }], true)]
    : [regua(pack, hojeSP, principal, lados, [{ canal: canais[0], letra: 'A' }, { canal: canais[1], letra: 'B' }], false)]

  const ROT: Record<IdLeitura, { t: string; s: string }> = {
    a: { t: 'Canal inteiro', s: 'views ganhas nos últimos 28 dias contra os 28 anteriores' },
    b: { t: 'Vídeos novos, views de hoje', s: 'mediana dos longos publicados em 90 dias contra os 90 anteriores. Descer pode ser só idade' },
    c: { t: 'Vídeos novos, mesma idade', s: 'views aos 30 dias de cada vídeo, sem favorecer o vídeo mais velho' },
  }
  const existeEm = mesmaIdadeExisteEm()
  const linha = (id: IdLeitura, papel: 'principal' | 'apoio'): LinhaDeDirecao => ({
    id, papel, titulo: ROT[id].t, sub: ROT[id].s, lados: [medidaDe(la, id), medidaDe(lb, id)],
    reguas: papel === 'principal' ? reguas : [], relacao: null,
    nota: id === 'c' && papel === 'apoio' && hojeSP < existeEm ? `Existe a partir de ${dm(existeEm)}/${existeEm.slice(0, 4)}, com 180 dias de registro.` : null,
  })
  const linhas: LinhaDeDirecao[] = [linha(principal, 'principal'), ...apoios.map(i => linha(i, 'apoio'))]

  const pa = la.pub, pb = lb.pub
  const ate = la.ate ?? lb.ate
  const rel = pa.tipo === 'medido' && pb.tipo === 'medido'
    ? relacaoDoPar(pa.recente, pb.recente, nomes, { art: 'os', noun: 'longos publicados', plural: true, ate }) : null
  linhas.push({
    id: 'pub', papel: 'contagem', titulo: 'Longos publicados', sub: 'nos últimos 90 dias contra os 90 anteriores; é uma contagem, não a frequência',
    lados: [pa, pb], reguas: [], relacao: rel, nota: null,
  })

  const jan = (d: number) => dm(soma(hojeSP, d))
  const leituraPrincipal = principal === 'a'
    ? `canal inteiro, ${jan(-27)} a ${dm(hojeSP)} contra ${jan(-55)} a ${jan(-28)}`
    : 'vídeos novos na mesma idade, 90 dias contra 90'
  return {
    principal, leituraPrincipal, linhas,
    frases: [fraseDoLado(la, canais[0].name, principal), fraseDoLado(lb, canais[1].name, principal)],
  }
}


/** O fecho de cada frase de lado, como a tela e o pacote o escrevem. */
function fechoDoApoio(a: ApoioDoLado): string {
  switch (a.tipo) {
    case 'concordam': return ' As outras leituras concordam.'
    case 'em_parte': return ` Concordam em parte: ${a.detalhe}.`
    case 'divergem': return ` As leituras divergem: ${a.detalhe}.`
    case 'sem': return ''
  }
}
/** A frase de um lado do grupo Direção, escrita. */
export function fraseEscrita(f: FraseDoLado): string {
  switch (f.tipo) {
    case 'erro': return `${f.nome}: a leitura dos números falhou.`
    case 'sem_direcao': return `${f.nome}: sem direção, ${f.porque}.`
    case 'direcao': return `${f.nome}: ${PALAVRA[f.simbolo]}, ${f.corpo}.${fechoDoApoio(f.apoio)}`
  }
}
