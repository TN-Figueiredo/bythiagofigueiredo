import { USER_AGENT_LEITOR, ACCEPT_LANGUAGE_LEITOR, urlWatch } from '../../../../lib/youtube/watch/cabecalhos'
import { contarPagina, rodadaMista, IDS_RAJADA, VIDEO_PV, type ContagemPv } from './contar'

export const RODADAS = 10
export const LEITURAS_POR_RODADA = 3
export const PAUSA_ENTRE_LEITURAS_MS = 1_500
export const PAUSA_ENTRE_RODADAS_MS = 15_000
export const RODADA_NAO_COMECA_APOS_MS = 200_000
export const FASE2_NAO_COMECA_APOS_MS = 200_000
export const LEITURA_NAO_COMECA_APOS_MS = 270_000
/** Depois desta data a rota se desativa sozinha (cada chamada faz 78 requisições ao YouTube). */
export const VALIDA_ATE = Date.parse('2026-10-22T00:00:00Z')
export const CONCORRENCIA_RAJADA = 3
export const PASSADAS = 3
export const TIMEOUT_LEITURA_MS = 10_000
export const LEITURAS_FASE2 = IDS_RAJADA.length * PASSADAS

export type LeituraPv = ContagemPv & { ms: number; erro?: string }

export interface ExecutarDeps {
  fetch: typeof fetch
  agora: () => number
  dormir: (ms: number) => Promise<void>
  regiao: string | null
}

export interface RespostaPv {
  versao: 1
  regiao: string | null
  inicio: string
  fase1: {
    rodadas: Array<{ i: number; leituras: Array<LeituraPv & { t: string }>; mista: boolean }>
    resumo: { leituras: number; http200: number; tres_renderers: number; hl_gl_ptbr: number; oficial: number; consentimento: number; bloqueios: number; mistas: number }
  }
  fase2: { paredeMs: number; lidas: number; leituras: Array<LeituraPv & { v: string; passada: 1 | 2 | 3 }>; bloqueios: number }
  cortado: null | 'fase1' | 'fase2'
}

const VAZIA: ContagemPv = { http: 0, renderers: 0, braco: '?', hl: null, gl: null, oficial: false, consentimento: false, roboSemTitulo: false, jogadorBloqueado: false }

export function ehBloqueio(c: ContagemPv): boolean {
  return c.http === 429 || c.roboSemTitulo || c.consentimento
}

async function ler(deps: ExecutarDeps, v: string): Promise<LeituraPv> {
  const t0 = deps.agora()
  try {
    const res = await deps.fetch(urlWatch(v), {
      headers: { 'Accept-Language': ACCEPT_LANGUAGE_LEITOR, 'User-Agent': USER_AGENT_LEITOR },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_LEITURA_MS),
    })
    const html = res.status >= 300 && res.status < 400 ? '' : await res.text()
    const c = contarPagina(html, res.status, res.headers.get('location'), v)
    return { ...c, ms: deps.agora() - t0 }
  } catch {
    return { ...VAZIA, ms: deps.agora() - t0, erro: 'rede' }
  }
}

export async function executarPv(deps: ExecutarDeps): Promise<RespostaPv> {
  const inicioMs = deps.agora()
  const decorrido = () => deps.agora() - inicioMs
  let cortado: RespostaPv['cortado'] = null

  // Fase 1: 10 rodadas x 3 leituras do vídeo do teste.
  const rodadas: RespostaPv['fase1']['rodadas'] = []
  for (let i = 1; i <= RODADAS; i++) {
    if (i > 1) await deps.dormir(PAUSA_ENTRE_RODADAS_MS)
    if (decorrido() >= RODADA_NAO_COMECA_APOS_MS) { cortado = 'fase1'; break }
    const leituras: Array<LeituraPv & { t: string }> = []
    for (let k = 0; k < LEITURAS_POR_RODADA; k++) {
      if (k > 0) await deps.dormir(PAUSA_ENTRE_LEITURAS_MS)
      const t = new Date(deps.agora()).toISOString()
      leituras.push({ ...(await ler(deps, VIDEO_PV)), t })
    }
    rodadas.push({ i, leituras, mista: rodadaMista(leituras.map((l) => l.braco)) })
  }
  const todas = rodadas.flatMap((r) => r.leituras)
  const resumo = {
    leituras: todas.length,
    http200: todas.filter((l) => l.http === 200).length,
    tres_renderers: todas.filter((l) => l.renderers === 3).length,
    hl_gl_ptbr: todas.filter((l) => l.hl === 'pt' && l.gl === 'BR').length,
    oficial: todas.filter((l) => l.oficial).length,
    consentimento: todas.filter((l) => l.consentimento).length,
    bloqueios: todas.filter(ehBloqueio).length,
    mistas: rodadas.filter((r) => r.mista).length,
  }

  // Fase 2: 16 vídeos, 3 passadas cada, pool de 3 (cada vídeo lido em sequência por um só trabalhador).
  const leiturasF2: RespostaPv['fase2']['leituras'] = []
  const f2Inicio = deps.agora()
  if (decorrido() < FASE2_NAO_COMECA_APOS_MS) {
    const fila = [...IDS_RAJADA]
    const trabalhador = async () => {
      for (let v = fila.shift(); v !== undefined; v = fila.shift()) {
        for (const passada of [1, 2, 3] as const) {
          if (decorrido() >= LEITURA_NAO_COMECA_APOS_MS) { cortado ??= 'fase2'; return }
          leiturasF2.push({ ...(await ler(deps, v)), v, passada })
        }
      }
    }
    await Promise.all(Array.from({ length: CONCORRENCIA_RAJADA }, trabalhador))
  } else {
    cortado ??= 'fase2'
  }

  return {
    versao: 1,
    regiao: deps.regiao,
    inicio: new Date(inicioMs).toISOString(),
    fase1: { rodadas, resumo },
    fase2: { paredeMs: deps.agora() - f2Inicio, lidas: leiturasF2.length, leituras: leiturasF2, bloqueios: leiturasF2.filter(ehBloqueio).length },
    cortado,
  }
}
