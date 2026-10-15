// A5 2ª leva: os textos das dicas por célula (REVISAO-LOGAN-R3.md, mockup 17). Puro.
import type { GrowthCell } from './view-model'
import type { CelulaDeDirecao } from './direcao-model'

export interface Escrita {
  num: (n: number) => string
  dec1: (n: number) => string
  dm: (ms: number) => string
  /** ms; um `fechaEm` no passado vira frase sem a data (coleta parada). */
  agora: number
}

const MENOS = '−'
const sinal = (n: number): string => (n > 0 ? '+' : n < 0 ? MENOS : '')
const dmTexto = (d: string): string => `${d.slice(8, 10)}/${d.slice(5, 7)}`
const JANELA_DIRECAO = 28
const pluralVideos = (formato: 'long' | 'short'): string => (formato === 'long' ? 'vídeos longos' : 'Shorts')

export function dicaInscritos(f: { subs: number | null; passo: number }, e: Escrita): string {
  if (f.subs == null) return 'O canal esconde o número de inscritos; não há o que mostrar.'
  if (f.subs < 1000) return `${e.num(f.subs)} inscritos. Abaixo de mil, o YouTube mostra o número exato.`
  return `${e.num(f.subs)} inscritos. O YouTube corta a contagem para 3 algarismos: o número real é este ou um pouco maior, em menos de ${e.num(f.passo)}.`
}

export function dicaViewsDia(f: { mediana: number | null; n: number; desde: string; porMil: number | null; oculto: boolean; fraco: boolean; formato: 'long' | 'short' }, e: Escrita): string | null {
  if (f.mediana == null) return null
  let t = `${e.num(f.mediana)} views por dia: a mediana dos ${f.n} ${pluralVideos(f.formato)} acompanhados ${f.desde}.`
  if (f.oculto) t += ' Inscritos ocultos: sem proporção por mil.'
  else if (f.porMil != null) t += ` Por mil inscritos: ${f.porMil < 0.1 ? 'menos de 0,1' : e.dec1(f.porMil)} views por dia.`
  if (f.fraco) t += ' Poucos vídeos: leia com cautela.'
  return t
}

export function dicaRitmo(f: { longos: number; shorts: number; ultimoHaDias: number | null; partialText: string | null }): string {
  let t = `Em 13 semanas: ${f.longos} ${f.longos === 1 ? 'vídeo longo' : 'vídeos longos'} e ${f.shorts} ${f.shorts === 1 ? 'Short' : 'Shorts'}.`
  if (f.ultimoHaDias != null) t += f.ultimoHaDias === 0 ? ' Último vídeo hoje.' : ` Último vídeo há ${f.ultimoHaDias} ${f.ultimoHaDias === 1 ? 'dia' : 'dias'}.`
  if (f.partialText) t += ` ${f.partialText}`
  return t
}

export function dicaOutliers(f: { melhor: { titulo: string; mult: number; views: number; esperado: number } | null; nVideos: number; fraco: boolean; formato: 'long' | 'short' }, e: Escrita): string {
  if (f.melhor) return `“${f.melhor.titulo}”: ${e.dec1(f.melhor.mult)}× as views típicas do canal na mesma idade (${e.num(f.melhor.views)} contra ${e.num(f.melhor.esperado)}).`
  if (f.fraco) return `Só ${f.nVideos} ${pluralVideos(f.formato)}: ainda não dá para saber o que é típico deste canal.`
  return 'Nenhum vídeo dos últimos 90 dias passou de 2× as views típicas do canal.'
}

export function dicaTrocas(f: { ultima: { tipo: 'title' | 'thumb' | 'ambos'; titulo: string; haDias: number; em: number } | null }, e: Escrita): string {
  if (!f.ultima) return 'Nenhuma troca de título ou thumbnail nos últimos 30 dias.'
  const u = f.ultima
  const o = u.tipo === 'title' ? 'o título' : u.tipo === 'thumb' ? 'a thumbnail' : 'o título e a thumbnail'
  const quando = u.haDias <= 0 ? 'hoje' : u.haDias === 1 ? 'há 1 dia' : `há ${u.haDias} dias`
  return `Mudou ${o} de “${u.titulo}”, ${quando} (${e.dm(u.em)}).`
}

const listaHorarios = (h: readonly string[]): string => (h.length < 2 ? h.join('') : `${h.slice(0, -1).join(', ')} e ${h[h.length - 1]}`)

export function dicaSync(f: { estado: 'ok' | 'erro'; ha: string; nVideos: number; horarios: readonly string[]; proprio: string | null }): string {
  if (f.estado === 'erro') {
    const quem = f.ha ? `A tentativa de ${f.ha}` : 'A última tentativa'
    return `${quem} não completou. Seguimos com os dados de antes (${f.nVideos} vídeos) e tentamos de novo na próxima sincronização.`
  }
  const primeira = `Última sincronização ${f.ha}, com ${f.nVideos} vídeos acompanhados.`
  if (f.proprio) return `${primeira} ${f.proprio}`
  return `${primeira} Automática às ${listaHorarios(f.horarios)} (São Paulo).`
}

export function dicaCrescimento(g: GrowthCell, e: Escrita, proprio: boolean): string {
  if (g.kind === 'na') {
    if (g.motivo === 'sem-registro') return proprio ? 'Seu canal ainda não tem a coleta de inscritos ligada. Passa a medir 30 dias depois de ligada.' : g.title
    if (g.motivo === 'oculto') return 'O canal esconde os inscritos: não há o que comparar. Sem data prevista; só muda se ele mostrar.'
    if (g.motivo === 'novo' && g.dias != null) {
      return `Só ${g.dias} dias de registro; a medida pede 30.` + (g.fechaEm != null && g.fechaEm >= e.agora ? ` A janela fecha em ${e.dm(g.fechaEm)}.` : '')
    }
    return g.title
  }
  const parada = g.atrasadoAte != null ? ` Última contagem em ${e.dm(g.atrasadoAte)}: a coleta está parada.` : ''
  if (g.antes == null || g.depois == null || g.de == null || g.ate == null) return g.cap || g.big
  const abre = `De ${e.num(g.antes)} inscritos em ${e.dm(g.de)} para ${e.num(g.depois)} em ${e.dm(g.ate)}`
  if (g.kind === 'flat') {
    if (g.limite === 0) return `${abre}: o mesmo número nas duas contagens.${parada}`
    const gan = g.abs === 0 ? '0' : `${sinal(g.abs)}${e.num(Math.abs(g.abs))}`
    return `${abre} (${gan}). A diferença é menor que ${e.num(g.limite)}, dentro do que o corte da contagem pelo YouTube explica.${parada}`
  }
  return `${abre}: ${sinal(g.abs)}${e.num(Math.abs(g.abs))} (${g.big}). Inscritos arredondados a 3 algarismos pelo YouTube.${parada}`
}

export function dicaDirecao(d: CelulaDeDirecao, numeros: { recente: string; anterior: string } | null, _e: Escrita): string | null {
  void _e
  if (d.tipo === 'nao_carregou') return null
  if (d.tipo === 'canal_proprio') return 'Esta coluna não mede a Direção do seu canal. Sem data prevista.'
  if (d.tipo === 'nao_medido') {
    if (d.motivo === 'pouco_registro' && d.n != null && d.fechaEm) return `Só ${d.n} dias de registro; a medida pede 56 (28 contra 28). A janela fecha em ${dmTexto(d.fechaEm)}.`
    return d.longa
  }
  if (!numeros) return null
  const base = `Últimos ${JANELA_DIRECAO} dias: ${numeros.recente} views. ${JANELA_DIRECAO} dias anteriores: ${numeros.anterior}.`
  const p = Math.abs(d.pct)
  if (d.simbolo === 'sobe') return `${base} Subiu ${p}%.`
  if (d.simbolo === 'desce') return `${base} Caiu ${p}%.`
  return `${base} Variou ${sinal(d.pct)}${p}%. Até 10% para cima ou para baixo conta como sem mudança.`
}
