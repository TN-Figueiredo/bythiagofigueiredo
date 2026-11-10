// @vitest-environment node
/**
 * S1b: o grão semana de uma `serie` de concorrente, com o pacote do EMPACOTADOR REAL (não modelo sintético). O defeito: `x: null` nas células da
 * `canal-linha-do-tempo` fazia toda semana sair "0 de 7 dias medidos". Aqui o `responder` lê o pacote que `projetarMedidas` + `empacotarCanal` montam.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ pacote: null as unknown }))
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }))
vi.mock('@/app/cms/(authed)/youtube/competitors/_contexto-ia', () => ({
  EMPACOTAR: new Proxy({}, { get: (_t, k) => (k === 'canal' ? async () => m.pacote : async () => null) }),
}))

import { diaDaLinha, responder } from '@/app/cms/(authed)/youtube/competitors/_acesso-ia/responder'
import { ABRIDOR_DE_SESSAO } from '@/app/cms/(authed)/youtube/competitors/_chrome/abridor'
import { canalWorld } from './canal-fixture'
import { buildCanalView } from '@/app/cms/(authed)/youtube/competitors/_canal/view-model'
import { empacotarCanal, modeloDeCanal } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal'
import { projetarMedidas } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-canal-medidas'
import type { ContextoDoCanal } from '@/app/cms/(authed)/youtube/competitors/_canal/medidas/canal-derivado'
import { medidasDoCanal, type Insumos } from '@/lib/youtube/observatorio/medidas/do-canal'
import type { CanalInteiro } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-canal'
import type { PacoteModelo } from '@/lib/youtube/observatorio/contexto-ia/tipos'
import { AGORA_CHEIA, HOJE_CHEIA, insumosCheios } from './medidas-fixture'

const C1 = '11111111-1111-4111-8111-111111111111'

function canalDe(ins: Insumos): CanalInteiro {
  const naoLido = { lido: false, causa: 'erro_do_banco' } as const
  return {
    medidas: medidasDoCanal(ins, { agoraMs: AGORA_CHEIA }),
    videos: ins.videos.lido ? { lido: true, dados: ins.videos.dados } : naoLido,
    retratos: ins.retratos.lido ? { lido: true, dados: ins.retratos.dados } : naoLido,
    marcas: ins.marcas.lido ? { lido: true, dados: ins.marcas.dados } : naoLido,
    serie: ins.series !== 'nao_pedida' && ins.series.lido ? { lido: true, dados: ins.series.dados.series } : 'nao_pedida',
    mudancas: ins.mudancas !== 'nao_pedida' && ins.mudancas.lido ? { lido: true, dados: ins.mudancas.dados.mudancas } : 'nao_pedida',
    horas: 'nao_pedida', falhas: [], esgotou: [],
  }
}
const contexto = (): ContextoDoCanal => ({
  F: { num: (v: number | null) => (v === null ? '—' : String(Math.round(v))), subs: (v: number) => String(v) } as unknown as ContextoDoCanal['F'],
  subs: 84_000, sync: { state: 'ok', last: AGORA_CHEIA - 3_600_000, errorSince: null }, hojeSP: HOJE_CHEIA, agoraMs: AGORA_CHEIA, primeiraBusca: false, semVideos: false,
  titulos: [], trocas: [], thumbs: [], criador: { nome: 'Matt Wolfe', avatar: null, ini: 'MW', color: '#336699' },
})
function pacoteReal(): PacoteModelo {
  const { obs, chId } = canalWorld()
  const view = buildCanalView(obs, chId, {})!
  return empacotarCanal(modeloDeCanal(view, null, projetarMedidas(canalDe(insumosCheios()), contexto(), null)))
}

const isoDe = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const segundaDe = (d: string): string => { const ms = Date.parse(`${d}T00:00:00Z`); return isoDe(ms - ((new Date(ms).getUTCDay() + 6) % 7) * 86_400_000) }
const mais = (d: string, n: number): string => isoDe(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000)

/** Uma segunda a domingo inteira dentro da série `canal-linha-do-tempo`, com os `x` do pacote (a verdade das 7 células). */
function semanaCheia(p: PacoteModelo): { de: string; ate: string; soma: number; dias: string[] } {
  const t = p.tabelas.find((x) => x.id === 'canal-linha-do-tempo')!
  const porDia = new Map<string, number>()
  for (const l of t.linhas) {
    const v = l[1]!, dia = diaDaLinha(l, AGORA_CHEIA)
    if (dia && v.papel === 'numero' && v.estado === 'medido') porDia.set(dia, v.x ?? Number.NaN)
  }
  for (const d of [...porDia.keys()].sort()) {
    const seg = segundaDe(d)
    const dias = Array.from({ length: 7 }, (_, i) => mais(seg, i))
    if (seg === d && dias.every((x) => porDia.has(x))) return { de: seg, ate: dias[6]!, soma: dias.reduce((a, x) => a + porDia.get(x)!, 0), dias }
  }
  throw new Error('a fixture não tem uma semana inteira medida')
}

beforeEach(() => { m.pacote = { modelo: pacoteReal(), recente: '13/10/2026 09:10', estado: {} } })

describe('S1b: serie grão semana com o pacote do empacotador real', () => {
  it('as células do ganho por dia levam o número de máquina em x (não null)', () => {
    const t = pacoteReal().tabelas.find((x) => x.id === 'canal-linha-do-tempo')!
    const medidos = t.linhas.map((l) => l[1]!).filter((c) => c.papel === 'numero' && c.estado === 'medido')
    expect(medidos.length).toBeGreaterThan(0)
    expect(medidos.every((c) => c.papel === 'numero' && c.estado === 'medido' && typeof c.x === 'number')).toBe(true)
  })

  it('semana cheia: 7 de 7 e a soma dos 7 ganhos', async () => {
    const s = semanaCheia((m.pacote as { modelo: PacoteModelo }).modelo)
    const r = await responder({ acao: 'serie', canal_id: C1, de: s.de, ate: s.ate, grao: 'semana' }, ABRIDOR_DE_SESSAO, AGORA_CHEIA)
    expect(r.texto).not.toContain('0 de 7 dias medidos')
    expect(r.texto).not.toMatch(/semana incompleta/)
    expect(r.texto).toContain(String(Math.round(s.soma * 100) / 100))
  })

  it('dia sem medida na semana: continua incompleta (6 de 7), sem soma', async () => {
    const pacote = (m.pacote as { modelo: PacoteModelo }).modelo
    const s = semanaCheia(pacote)
        const t = pacote.tabelas.find((x) => x.id === 'canal-linha-do-tempo')!
    const linhas = t.linhas.map((l) => (diaDaLinha(l, AGORA_CHEIA) === s.dias[3]
      ? [l[0]!, { papel: 'numero' as const, estado: 'nao_medido' as const, motivo: 'sem registro', origem: 'x' }, ...l.slice(2)] : l))
    m.pacote = { modelo: { ...pacote, tabelas: pacote.tabelas.map((x) => (x.id === t.id ? { ...x, linhas } : x)) }, recente: '13/10/2026 09:10', estado: {} }
    const r = await responder({ acao: 'serie', canal_id: C1, de: s.de, ate: s.ate, grao: 'semana' }, ABRIDOR_DE_SESSAO, AGORA_CHEIA)
    expect(r.texto).toMatch(/6 de 7 dias medidos/)
    expect(r.texto).toMatch(/semana incompleta/)
    expect(r.texto).not.toContain(String(Math.round(s.soma * 100) / 100))
  })
})
