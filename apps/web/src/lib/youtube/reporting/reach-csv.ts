// Leitor do CSV de `channel_reach_basic_a1` (impressões e CTR de miniatura por vídeo e dia). Puro: sem banco, sem rede.
// Escrito contra o cabeçalho REAL lido de produção em 09/10/2026; o teste roda sobre o arquivo exportado.
// Nenhum campo deste relatório traz vírgula ou aspas, então a linha é separada por vírgula simples —
// e campo com aspas é linha inválida, nunca lido por aproximação. O CTR vem em 0–1 (medido no arquivo real):
// fora dessa faixa (um percentual como 33.3, por exemplo) é linha inválida, e data que não existe no calendário também.

export const CABECALHO_ALCANCE_BASICO = [
  'date', 'channel_id', 'video_id', 'video_thumbnail_impressions', 'video_thumbnail_impressions_ctr',
] as const

export class CsvAlcanceError extends Error {
  constructor(public readonly motivo: 'cabecalho_inesperado' | 'linha_invalida') {
    super(`CSV de alcance: ${motivo}`)
    this.name = 'CsvAlcanceError'
  }
}

export interface LinhaAlcance {
  /** AAAA-MM-DD, o dia como veio do relatório (só reformatado). */
  day: string
  channelId: string
  videoId: string
  impressions: number
  /** Na unidade do relatório (0–1). Campo vazio = nulo. */
  ctr: number | null
}

export interface AlcanceDoDia { day: string; videoId: string; impressions: number; ctr: number | null }

const DATA = /^(\d{4})(\d{2})(\d{2})$/
const INTEIRO = /^\d+$/

/** Confere ano, mês e dia pelo calendário (20260229 e 20261345 não existem). */
function dataExiste(ano: number, mes: number, dia: number): boolean {
  if (ano < 1) return false
  const t = new Date(Date.UTC(ano, mes - 1, dia))
  t.setUTCFullYear(ano) // Date.UTC trata anos 0–99 como 1900–1999
  return t.getUTCFullYear() === ano && t.getUTCMonth() === mes - 1 && t.getUTCDate() === dia
}

export function lerAlcanceBasico(csv: string): LinhaAlcance[] {
  const linhas = csv.split(/\r?\n/).filter(l => l.trim().length > 0)
  const cab = (linhas[0] ?? '').split(',').map(c => c.trim())
  const esperado: readonly string[] = CABECALHO_ALCANCE_BASICO
  if (cab.length !== esperado.length || !esperado.every(c => cab.includes(c))) throw new CsvAlcanceError('cabecalho_inesperado')
  const pos = (nome: string) => cab.indexOf(nome)
  const [iData, iCanal, iVideo, iImp, iCtr] = esperado.map(pos) as [number, number, number, number, number]

  return linhas.slice(1).map((l) => {
    const c = l.split(',').map(x => x.trim())
    if (c.length !== cab.length || l.includes('"')) throw new CsvAlcanceError('linha_invalida')
    const d = DATA.exec(c[iData]!)
    if (!d || !dataExiste(Number(d[1]), Number(d[2]), Number(d[3])) || !c[iCanal] || !c[iVideo] || !INTEIRO.test(c[iImp]!)) throw new CsvAlcanceError('linha_invalida')
    const bruto = c[iCtr]!
    const ctr = bruto === '' ? null : Number(bruto)
    if (ctr !== null && (!Number.isFinite(ctr) || ctr < 0 || ctr > 1)) throw new CsvAlcanceError('linha_invalida')
    return { day: `${d[1]}-${d[2]}-${d[3]}`, channelId: c[iCanal]!, videoId: c[iVideo]!, impressions: Number(c[iImp]), ctr }
  })
}

/** Não separa por canal: quem chama confere o canal das linhas antes de agregar.
 *  Uma linha por vídeo e dia: impressões somam; CTR = média ponderada pelas impressões das linhas que têm CTR. */
export function agregarAlcance(linhas: readonly LinhaAlcance[]): AlcanceDoDia[] {
  const grupos = new Map<string, { day: string; videoId: string; impressions: number; peso: number; cliques: number }>()
  for (const l of linhas) {
    const chave = `${l.videoId}|${l.day}`
    const g = grupos.get(chave) ?? { day: l.day, videoId: l.videoId, impressions: 0, peso: 0, cliques: 0 }
    g.impressions += l.impressions
    if (l.ctr !== null) { g.peso += l.impressions; g.cliques += l.impressions * l.ctr }
    grupos.set(chave, g)
  }
  return [...grupos.values()].map(g => ({ day: g.day, videoId: g.videoId, impressions: g.impressions, ctr: g.peso > 0 ? g.cliques / g.peso : null }))
}
