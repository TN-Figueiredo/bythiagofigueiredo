// Leitor do CSV de `channel_reach_combined_a1` (impressões e CTR de miniatura por vídeo, dia, origem, aparelho e sistema).
// Puro: sem banco, sem rede. Escrito contra o cabeçalho REAL de 9 colunas (F4 do plano da E11).
// Mesmas recusas de `reach-csv.ts`: campo com aspas, data que não existe e taxa fora de 0–1 são linha inválida.
// Os três códigos (aparelho, sistema, origem) seguem a regra da tabela. `traffic_source_detail` pode ser termo
// pesquisado (dado privado): é lido para conferir a contagem de campos e DESCARTADO aqui; nunca sai do módulo,
// e nenhuma mensagem de erro leva o conteúdo de linha alguma.

export const CABECALHO_ALCANCE_COMBINADO = [
  'date', 'channel_id', 'video_id', 'device_type', 'operating_system', 'traffic_source_type',
  'traffic_source_detail', 'video_thumbnail_impressions', 'video_thumbnail_impressions_ctr',
] as const

export class CsvAlcanceCombinadoError extends Error {
  constructor(public readonly motivo: 'cabecalho_inesperado' | 'linha_invalida') {
    super(`CSV de alcance combinado: ${motivo}`)
    this.name = 'CsvAlcanceCombinadoError'
  }
}

export interface LinhaAlcanceCombinado {
  /** AAAA-MM-DD, o dia como veio do relatório (só reformatado). */
  day: string
  channelId: string
  videoId: string
  deviceType: string
  operatingSystem: string
  trafficSourceType: string
  impressions: number
  /** Na unidade do relatório (0–1). Campo vazio = nulo. */
  ctr: number | null
}

export interface AlcanceDimDoDia {
  day: string
  videoId: string
  trafficSourceType: string
  deviceType: string
  operatingSystem: string
  impressions: number
  /** Soma de impressões × taxa; nulo se alguma linha da chave veio sem taxa. */
  clicksEst: number | null
}

/** Linhas agregadas e a contagem das chaves de 0 impressões que saíram. Objeto simples: sobrevive a `.map`, spread e JSON. */
export interface AlcanceDimAgregado {
  linhas: AlcanceDimDoDia[]
  descartadasZeradas: number
}

const DATA = /^(\d{4})(\d{2})(\d{2})$/
const INTEIRO = /^\d+$/
/** Decimal sem sinal, hexadecimal nem binário; aceita notação científica (o YouTube emite 1.0E-4 para valor minúsculo). */
const NUMERO = /^\d+(\.\d+)?([eE][+-]?\d+)?$/
const ID_VIDEO = /^[A-Za-z0-9_-]{11}$/
const ID_CANAL = /^UC[A-Za-z0-9_-]{22}$/
const CODIGO = /^[A-Za-z0-9_]{1,40}$/

/** Confere ano, mês e dia pelo calendário (20260229 e 20261345 não existem). */
function dataExiste(ano: number, mes: number, dia: number): boolean {
  if (ano < 1) return false
  const t = new Date(Date.UTC(ano, mes - 1, dia))
  t.setUTCFullYear(ano) // Date.UTC trata anos 0–99 como 1900–1999
  return t.getUTCFullYear() === ano && t.getUTCMonth() === mes - 1 && t.getUTCDate() === dia
}

export function lerAlcanceCombinado(csv: string): LinhaAlcanceCombinado[] {
  const linhas = csv.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim().length > 0)
  const cab = (linhas[0] ?? '').split(',').map(c => c.trim())
  const esperado: readonly string[] = CABECALHO_ALCANCE_COMBINADO
  if (cab.length !== esperado.length || !esperado.every(c => cab.includes(c))) throw new CsvAlcanceCombinadoError('cabecalho_inesperado')
  const idx = (nome: string) => cab.indexOf(nome)
  const iData = idx('date'), iCanal = idx('channel_id'), iVideo = idx('video_id')
  const iAparelho = idx('device_type'), iSo = idx('operating_system'), iOrigem = idx('traffic_source_type')
  const iImp = idx('video_thumbnail_impressions'), iCtr = idx('video_thumbnail_impressions_ctr')

  return linhas.slice(1).map((l) => {
    const c = l.split(',').map(x => x.trim())
    if (c.length !== cab.length || l.includes('"')) throw new CsvAlcanceCombinadoError('linha_invalida')
    const d = DATA.exec(c[iData]!)
    if (!d || !dataExiste(Number(d[1]), Number(d[2]), Number(d[3])) || !ID_CANAL.test(c[iCanal]!) || !ID_VIDEO.test(c[iVideo]!) || !INTEIRO.test(c[iImp]!)
      || !CODIGO.test(c[iAparelho]!) || !CODIGO.test(c[iSo]!) || !CODIGO.test(c[iOrigem]!)) throw new CsvAlcanceCombinadoError('linha_invalida')
    const impressions = Number(c[iImp])
    if (!Number.isSafeInteger(impressions)) throw new CsvAlcanceCombinadoError('linha_invalida')
    const bruto = c[iCtr]!
    if (bruto !== '' && !NUMERO.test(bruto)) throw new CsvAlcanceCombinadoError('linha_invalida')
    const ctr = bruto === '' ? null : Number(bruto)
    if (ctr !== null && (!Number.isFinite(ctr) || ctr < 0 || ctr > 1)) throw new CsvAlcanceCombinadoError('linha_invalida')
    return {
      day: `${d[1]}-${d[2]}-${d[3]}`, channelId: c[iCanal]!, videoId: c[iVideo]!,
      deviceType: c[iAparelho]!, operatingSystem: c[iSo]!, trafficSourceType: c[iOrigem]!,
      impressions, ctr,
    }
  })
}

/** Não separa por canal: quem chama confere o canal das linhas antes de agregar.
 *  Chave: (vídeo, dia, origem, aparelho, sistema). Impressões somam; `clicksEst` = soma de impressões × taxa,
 *  ou nulo se alguma linha da chave COM impressões veio sem taxa. Linha de 0 impressões contribui 0 cliques com
 *  qualquer taxa (inclusive nula) e por isso não anula a chave: desvio deliberado da letra do plano, a favor do dado.
 *  Chave com 0 impressões sai e é contada em `descartadasZeradas`. */
export function agregarAlcanceCombinado(linhas: readonly LinhaAlcanceCombinado[]): AlcanceDimAgregado {
  const grupos = new Map<string, AlcanceDimDoDia>()
  for (const l of linhas) {
    const chave = JSON.stringify([l.videoId, l.day, l.trafficSourceType, l.deviceType, l.operatingSystem])
    const g = grupos.get(chave) ?? {
      day: l.day, videoId: l.videoId, trafficSourceType: l.trafficSourceType, deviceType: l.deviceType,
      operatingSystem: l.operatingSystem, impressions: 0, clicksEst: 0 as number | null,
    }
    g.impressions += l.impressions
    if (l.impressions > 0) {
      g.clicksEst = g.clicksEst === null || l.ctr === null ? null : g.clicksEst + l.impressions * l.ctr
    }
    grupos.set(chave, g)
  }
  const todas = [...grupos.values()]
  const uteis = todas.filter(g => g.impressions > 0)
  return { linhas: uteis, descartadasZeradas: todas.length - uteis.length }
}
