// A5 E5a, Tarefa 20 (mockup 13, bloco 3): o cartão da subida (M5) e a célula "Subida" da faixa de números. Puro, com o relógio por parâmetro.
// NENHUMA frase diz "depois da troca" nem afirma causa: a lista dos 14 dias antes é "só uma lista de coincidências".
// Os números (15 dias, 2 vezes, 1.000 views, 7 e 14 dias) saem de `MEASURE_RULES`; nenhum é escrito aqui.
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import type { Subida } from '@/lib/youtube/observatorio/medidas/subida'
import type { Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import { subidaFechaEm } from '@/lib/youtube/observatorio/medidas-telas/calendario-das-paginas'
import { dec, dm, milhar } from './formatos'
import { LISTA_CURTA_ATE, dentroDosDiasAntes, listaAgrupadaDosAntes, type MudancaNumerada } from './mudancas-model'

const R = MEASURE_RULES.rise
/** Dias de contagem por dia que a medida pede: 7 antes, o dia da subida e 7 depois. */
export const DIAS_NECESSARIOS = 2 * R.days + 1

export const NOTA_DA_LISTA = 'É só uma lista de coincidências: não diz o que causou a subida.'
export const INFO_DA_SEMANA = 'Contagem por semana: uma contagem a cada semana, em vez de uma por dia.'

export interface EntradaDaSubida {
  hojeSP: string
  /** O vídeo tem uma contagem por semana (`series_tier`). */
  semanal: boolean
  saiu: boolean
  /** Dias com leitura (contagem por dia) até hoje. Nulo = a série não foi lida (nunca zero: zero é "lida e vazia"). */
  diasDeContagem: number | null
  /** Nulo = a série não foi lida. */
  subidas: Medida<Subida[]> | null
  /** Nulo = as mudanças não foram lidas. */
  mudancas: readonly MudancaNumerada[] | null
  inicioDaContagem: string
  /** O vídeo foi publicado antes do início da contagem. */
  publicadoAntesDoInicio: boolean
}

export interface CartaoSubiu {
  tipo: 'subiu'
  dia: string
  ganho7: number
  fator: number | null
  fraseTopo: string
  /** A lista dos 14 dias antes, na frase curta quando passa de 4. */
  lista: string
  listaCarregou: boolean
  nota: typeof NOTA_DA_LISTA
}
export type CartaoDaSubida =
  | { tipo: 'nao_carregou'; frase: string }
  | { tipo: 'inconclusivo'; titulo: string; texto: string; info: string }
  | CartaoSubiu
  | { tipo: 'sem_subida'; titulo: string; texto: string }
  | { tipo: 'nao_medido'; titulo: string; motivo: 'faltam_dias' | 'saiu' | 'contagem_perdida'; texto: string; curto: string; fechaEm: string | null; feitos: number; total: number }

const ritmo = (ganho: number): string => milhar(Math.round(ganho / R.days))

function listaDosAntes(s: Subida, mudancas: readonly MudancaNumerada[] | null): { texto: string; carregou: boolean } {
  // TEXTO-A-REVISAR: mudanças não lidas nunca viram "nenhuma mudança"
  if (mudancas === null) return { texto: 'Não carregou: as mudanças deste vídeo não foram lidas.', carregou: false }
  const antes = listaAgrupadaDosAntes(mudancas, s.dia)
  const n = mudancas.filter((m) => dentroDosDiasAntes(m, s.dia)).length
  if (n === 0) return { texto: `Nenhuma mudança registrada nos ${R.lookbackDays} dias antes.`, carregou: true }
  if (n > LISTA_CURTA_ATE) return { texto: `${n} mudanças nos ${R.lookbackDays} dias antes da subida (a lista está logo abaixo).`, carregou: true }
  return { texto: `Mudanças nos ${R.lookbackDays} dias antes: ${antes.join(' e ')}.`, carregou: true }
}

export function cartaoDaSubida(e: EntradaDaSubida): CartaoDaSubida {
  if (e.semanal) {
    return {
      tipo: 'inconclusivo', titulo: 'inconclusivo: contagem por semana',
      texto: 'Com uma contagem por semana não dá para dizer se uma mudança veio antes de uma subida.', info: INFO_DA_SEMANA,
    }
  }
  if (e.subidas === null) return { tipo: 'nao_carregou', frase: 'Subida: não carregou. A contagem por dia deste vídeo não foi lida; tente de novo.' }
  if (e.subidas.estado === 'medido') {
    const s = e.subidas.valor[0]
    if (!s) {
      return {
        tipo: 'sem_subida', titulo: '＝ Sem subida',
        texto: `Nenhum dia teve o ritmo dos ${R.days} dias seguintes em ${R.factor} vezes o dos ${R.days} anteriores com ganho de ${milhar(R.minGain)} views ou mais.`,
      }
    }
    const depois = ritmo(s.ganho7)
    const antes = ritmo(s.ganho7Antes)
    const fraseTopo =
      s.fator === null
        // TEXTO-A-REVISAR: os 7 dias antes sem nenhuma view (a razão não existe)
        ? `▲ Subida em ${dm(s.dia)}: nos ${R.days} dias seguintes o vídeo ganhou ${milhar(s.ganho7)} views (${depois} por dia); nos ${R.days} dias antes não ganhou nenhuma.`
        : `▲ Subida em ${dm(s.dia)}: nos ${R.days} dias seguintes o vídeo ganhou ${milhar(s.ganho7)} views, ${dec(s.fator, 1)} ${Number(dec(s.fator, 1).replace(',', '.')) >= 2 ? 'vezes' : 'vez'} o ritmo dos ${R.days} dias antes (${depois} contra ${antes} por dia).`
    const l = listaDosAntes(s, e.mudancas)
    return { tipo: 'subiu', dia: s.dia, ganho7: s.ganho7, fator: s.fator, fraseTopo, lista: l.texto, listaCarregou: l.carregou, nota: NOTA_DA_LISTA }
  }
  // não medido. Série não lida, ou medida que falhou na E4 (leitura/cálculo) ou nem foi pedida: não se calcula "faltam N dias" (portão Phil I1, Yannis I-6)
  const m = e.subidas
  if (e.diasDeContagem === null || m.motivo === 'leitura_falhou' || m.motivo === 'calculo_falhou' || m.motivo === 'serie_nao_pedida') {
    return { tipo: 'nao_carregou', frase: 'Subida: não carregou. A contagem por dia deste vídeo não foi lida; tente de novo.' }
  }
  const dias = e.diasDeContagem
  const feitos = Math.min(DIAS_NECESSARIOS, Math.max(0, dias))
  const fecha = subidaFechaEm(dias, e.hojeSP)
  const precisa = `Precisa de ${DIAS_NECESSARIOS} dias de contagem por dia (${R.days} antes, o dia da subida e ${R.days} depois)`
  const titulo = 'Subida: não medido.'
  if (e.saiu) {
    return {
      tipo: 'nao_medido', titulo, motivo: 'saiu', curto: 'o vídeo saiu antes', fechaEm: null, feitos, total: DIAS_NECESSARIOS,
      texto: `${precisa}; o vídeo saiu do YouTube com ${dias} ${dias === 1 ? 'dia' : 'dias'} de contagem, então a subida não vai ser medida`,
    }
  }
  if (dias < DIAS_NECESSARIOS) {
    const faltam = DIAS_NECESSARIOS - dias
    const comecou = e.publicadoAntesDoInicio ? ` (começou em ${dm(e.inicioDaContagem)})` : ''
    return {
      tipo: 'nao_medido', titulo, motivo: 'faltam_dias', curto: `fecha em ${dm(fecha)}`, fechaEm: fecha, feitos, total: DIAS_NECESSARIOS,
      texto: `${precisa}; são ${dias}${comecou}. Faltam ${faltam}: fecha em ${dm(fecha)}`,
    }
  }
  return {
    tipo: 'nao_medido', titulo, motivo: 'contagem_perdida', curto: 'faltam dias', fechaEm: null, feitos, total: DIAS_NECESSARIOS,
    texto: `faltam contagens por dia (o vídeo entrou tarde na contagem e uma contagem se perdeu): sem ${R.days} dias antes e ${R.days} depois seguidos, não dá`,
  }
}

// ───── a célula "Subida" da faixa ─────

export interface CelulaDaSubida {
  rotulo: 'Subida'
  estado: 'ok' | 'neutro' | 'nao_medido' | 'nao_carregou'
  /** "16/10" · "nenhuma" · "contagem por semana". */
  valor: string | null
  /** "▲ 4,7× o ritmo" · "＝". */
  razao: string | null
  sub: string
}

export function celulaDaSubida(c: CartaoDaSubida, diasDeContagem: number | null): CelulaDaSubida {
  switch (c.tipo) {
    case 'inconclusivo': return { rotulo: 'Subida', estado: 'neutro', valor: 'contagem por semana', razao: null, sub: 'não dá para ver o dia' }
    case 'nao_carregou': return { rotulo: 'Subida', estado: 'nao_carregou', valor: null, razao: null, sub: 'não carregou' }
    case 'subiu':
      return { rotulo: 'Subida', estado: 'ok', valor: dm(c.dia), razao: c.fator === null ? '▲' : `▲ ${dec(c.fator, 1)}× o ritmo`, sub: `${R.days} dias depois contra ${R.days} antes` }
    case 'sem_subida': return { rotulo: 'Subida', estado: 'ok', valor: 'nenhuma', razao: '＝', sub: diasDeContagem === null ? 'não carregou' : `em ${diasDeContagem} dias` }
    case 'nao_medido': return { rotulo: 'Subida', estado: 'nao_medido', valor: null, razao: null, sub: c.curto }
  }
}
