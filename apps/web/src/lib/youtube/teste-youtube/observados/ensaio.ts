import type { LeituraObs, ThumbObs } from './inferir'

/** Uma leitura do export (replay da CI e ensaio a seco, §8.0): colunas de `yt_watch_readings` + miniatura + alvo. */
export interface LinhaExport {
  yt: string; rodada_id: string; lida_em: string; http: number | null; erro: string | null; jogador_bloqueado: boolean
  idioma: string | null; titulo_exibido: string | null; thumb_http: number | null; dhash: string | null; variante: string | null
  largura: number | null; altura: number | null; publicado_em: string | null
  canal?: string | null; saiu_em?: string | null; saiu_por?: string | null; alvo_rodadas?: number | null; ultima_rodada_em?: string | null
}
export interface FixtureColunar { fonte: string; agora: string; colunas: (keyof LinhaExport)[]; linhas: unknown[][] }
export interface AlvoExport {
  ytId: string; canal: string | null; publicadoEm: Date | null; saiuEm: string | null; saiuPor: string | null
  leituras: LeituraObs[]; thumbsPorId: Map<number, ThumbObs>; rodadas: number; ultimaRodadaEm: string | null
}

/** '2026-10-19 01:20:55.353+00' (ou '+00:00') -> '2026-10-19T01:20:55.353Z'. Pela Date, nunca por troca de texto. */
export function isoDoBanco(s: string): string {
  return new Date(s.replace(' ', 'T').replace(/\+00(:00)?$/, 'Z')).toISOString()
}

export function linhasDaFixture(f: FixtureColunar): LinhaExport[] {
  return f.linhas.map(v => {
    const o: Record<string, unknown> = {}
    f.colunas.forEach((c, i) => { o[c] = v[i] ?? null })
    return o as unknown as LinhaExport
  })
}

const ilegivel = (): Error => new Error('export ilegível')
const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Aceita: array de linhas, `[{ json_agg: [...] }]` (envelope da CLI), `{ rows: [...] }` e o colunar `{ colunas, linhas }`. */
export function extrairLinhas(texto: string): LinhaExport[] {
  let j: unknown
  try { j = JSON.parse(texto) } catch { throw ilegivel() }
  const desembrulhar = (v: unknown): LinhaExport[] => {
    if (ehObjeto(v)) {
      if (Array.isArray(v.colunas) && Array.isArray(v.linhas)) return linhasDaFixture(v as unknown as FixtureColunar)
      if (Array.isArray(v.rows)) return desembrulhar(v.rows)
      if ('json_agg' in v) return desembrulhar(typeof v.json_agg === 'string' ? JSON.parse(v.json_agg) : v.json_agg)
      throw ilegivel()
    }
    if (!Array.isArray(v)) throw ilegivel()
    if (v.length === 1 && ehObjeto(v[0]) && ('json_agg' in v[0] || 'rows' in v[0])) return desembrulhar(v[0])
    if (!v.every(x => ehObjeto(x) && typeof x.yt === 'string')) throw ilegivel()
    return v as LinhaExport[]
  }
  return desembrulhar(j)
}

export function carregarExport(linhas: readonly LinhaExport[]): Map<string, AlvoExport> {
  const out = new Map<string, AlvoExport>()
  const rodadasPorAlvo = new Map<string, Set<string>>()
  linhas.forEach((l, idx) => {
    let a = out.get(l.yt)
    if (!a) {
      a = { ytId: l.yt, canal: null, publicadoEm: null, saiuEm: null, saiuPor: null, leituras: [], thumbsPorId: new Map(), rodadas: 0, ultimaRodadaEm: null }
      out.set(l.yt, a)
      rodadasPorAlvo.set(l.yt, new Set())
    }
    rodadasPorAlvo.get(l.yt)!.add(l.rodada_id)
    if (a.canal === null && l.canal != null) a.canal = l.canal
    if (a.publicadoEm === null && l.publicado_em) a.publicadoEm = new Date(isoDoBanco(l.publicado_em))
    if (a.saiuEm === null && l.saiu_em) a.saiuEm = l.saiu_em
    if (a.saiuPor === null && l.saiu_por) a.saiuPor = l.saiu_por
    if (l.alvo_rodadas != null) a.rodadas = l.alvo_rodadas
    if (l.ultima_rodada_em) a.ultimaRodadaEm = l.ultima_rodada_em
    let miniaturaId: number | null = null
    if (l.thumb_http !== null) {
      miniaturaId = idx
      a.thumbsPorId.set(idx, { id: idx, variante: l.variante ?? '', http: l.thumb_http, dhash: l.dhash, largura: l.largura, altura: l.altura })
    }
    a.leituras.push({
      id: idx, rodadaId: l.rodada_id, lidaEm: isoDoBanco(l.lida_em), http: l.http, erro: l.erro, jogadorBloqueado: l.jogador_bloqueado,
      idioma: l.idioma, tituloExibido: l.titulo_exibido, tituloOficial: null, tituloFonte: null, miniaturaId,
    })
  })
  for (const a of out.values()) {
    a.leituras.sort((x, y) => Date.parse(x.lidaEm) - Date.parse(y.lidaEm) || x.id - y.id)
    const comOpcionais = linhas.some(l => l.yt === a.ytId && l.alvo_rodadas != null)
    if (!comOpcionais) a.rodadas = rodadasPorAlvo.get(a.ytId)!.size
    if (a.ultimaRodadaEm === null) a.ultimaRodadaEm = a.leituras.at(-1)?.lidaEm ?? null
  }
  return out
}
