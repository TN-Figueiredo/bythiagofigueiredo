// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REGRA_F4_TITULO, tituloComplementarPack, validarTitulosComplementares, novidadeTitulo, type AlvoTitulo, type OutlierCongelado } from '@/lib/youtube/observatorio/forja/titulo-complementar'
import { TargetUnavailableError } from '@/lib/youtube/observatorio/forja/sent'
import type { ForjaCtx } from '@/lib/youtube/observatorio/forja/scope'

const casos = JSON.parse(readFileSync(join(__dirname, '../../../fixtures/titulo-complementar-casos.json'), 'utf8')) as {
  sent: { numbers: string[]; titulo_complementar: unknown }; casos: Array<{ nome: string; itens: string[]; esperado: string }>
}

describe('validarTitulosComplementares (casos compartilhados com o kit)', () => {
  for (const c of casos.casos) {
    it(c.nome, () => {
      const r = validarTitulosComplementares(casos.sent, c.itens)
      expect(r.ok ? 'ok' : r.motivo).toBe(c.esperado)
    })
  }
})

const OWN_CH = 'own-ch', OWN_VID = 'own-vid', SIG = 'sig-1'
function ctxCom(nTitulos: number, titulos?: string[]): ForjaCtx {
  const V = new Map<string, { id: string; ch: string; title: string; pub: number }>()
  V.set(OWN_VID, { id: OWN_VID, ch: OWN_CH, title: 'Vietnã em 3 dias', pub: 1_000 + nTitulos + 5 })
  for (let i = 0; i < nTitulos; i++) V.set('v' + i, { id: 'v' + i, ch: OWN_CH, title: titulos?.[i] ?? 'Titulo numero ' + String(i).padStart(3, '0') + ' com cerca de sessenta caracteres ok', pub: 1_000 + i })
  const CH = new Map([[OWN_CH, { own: true }]])
  const fmt = { mult: (n: number) => String(n).replace('.', ',') + '×', num: (n: number) => String(n) }
  const clock = { snapTime: () => 123 }
  return { V, CH, fmt, clock, lastIdx: 5 } as unknown as ForjaCtx
}
const out = (id: string, titulo: string, mult = 8.2): OutlierCongelado => ({ video_id: id, canal_id: 'c-' + id, canal: 'Canal ' + id, titulo, mult_vpd7: mult, vpd7: 1500 })
const alvo = (over: Partial<AlvoTitulo> = {}): AlvoTitulo => ({
  ownVideoId: OWN_VID, signalId: SIG, descricao: 'Descrição '.repeat(100),
  congelado: { subject_key: 'pais:vn', lugar: 'Vietnã', outliers: [out('o1', 'Da Nang: 10 praias'), out('o2', 'O que ninguém conta')] }, sinal: { subjectKey: 'pais:vn', outliers: [] }, ...over,
})

describe('tituloComplementarPack', () => {
  it('250 títulos passados: respeita o teto de caracteres, grava titulos_enviados_n e os normalizados de TODOS', () => {
    const p = tituloComplementarPack(ctxCom(250), alvo())
    const t = p.titulo_complementar
    const soma = p.items.filter(i => i.kind === 'título do dono').reduce((a, i) => a + (i.title as string).length, 0)
    expect(soma).toBeLessThanOrEqual(REGRA_F4_TITULO.titulosPassadosMaxCaracteres)
    expect(t.titulos_enviados_n).toBe(p.items.filter(i => i.kind === 'título do dono').length)
    expect(t.titulos_enviados_n).toBeLessThan(t.titulos_total)
    expect(t.titulos_total).toBe(250)
    expect(t.normalizados_proprios).toHaveLength(251)   // 250 + o vídeo alvo
    expect(p.capped).toBe(true)
    // mais recentes primeiro
    expect(p.items.find(i => i.kind === 'título do dono')!.title).toContain('249')
  })
  it('início da descrição cortado em 300 caracteres', () => {
    const p = tituloComplementarPack(ctxCom(2), alvo())
    expect((p.items[0]!.description as string).length).toBeLessThanOrEqual(300)
  })
  it('sem sinal aberto e sem outliers congelados lança TargetUnavailableError', () => {
    expect(() => tituloComplementarPack(ctxCom(2), alvo({ congelado: null, sinal: null }))).toThrow(TargetUnavailableError)
    expect(() => tituloComplementarPack(ctxCom(2), alvo({ congelado: { subject_key: 'pais:vn', lugar: 'Vietnã', outliers: [] }, sinal: { subjectKey: 'pais:vn', outliers: [] } }))).toThrow(TargetUnavailableError)
  })
  it('vídeo que não é nosso ou desconhecido lança TargetUnavailableError', () => {
    expect(() => tituloComplementarPack(ctxCom(2), alvo({ ownVideoId: 'v1' === 'x' ? 'x' : 'nao-existe' }))).toThrow(TargetUnavailableError)
  })
  it('com outliers congelados e sinal fechado, monta', () => {
    const p = tituloComplementarPack(ctxCom(2), alvo({ sinal: null }))
    expect(p.nOutliers).toBe(2)
    expect(p.ids).toEqual([OWN_VID, 'o1', 'o2'])
  })
  it('sent.numbers inclui o "3" de um título enviado com "3 dias", o múltiplo e as views/dia', () => {
    const p = tituloComplementarPack(ctxCom(1, ['Roteiro de 3 dias em Hoi An']), alvo())
    expect(p.numbers).toEqual(expect.arrayContaining(['3', '8,2×', '1.500', '10']))
  })
  it('só os 5 primeiros outliers entram', () => {
    const muitos = Array.from({ length: 8 }, (_, i) => out('o' + i, 'Titulo ' + i))
    const p = tituloComplementarPack(ctxCom(1), alvo({ congelado: { subject_key: 'pais:vn', lugar: 'Vietnã', outliers: muitos } }))
    expect(p.nOutliers).toBe(5)
  })
  it('o pack montado passa pelo validador: título novo com número do pacote ok, repetido não', () => {
    const p = tituloComplementarPack(ctxCom(1, ['Roteiro de 3 dias em Hoi An']), alvo())
    expect(validarTitulosComplementares(p, ['Hoi An em 3 dias, sem pressa']).ok).toBe(true)
    expect(validarTitulosComplementares(p, ['roteiro de 3 dias em hoi an']).ok).toBe(false)
    expect(validarTitulosComplementares(p, ['DA NANG 10 PRAIAS']).ok).toBe(false)
  })
})

describe('novidadeTitulo (dado novo desde a última leitura do mesmo alvo)', () => {
  const prev = { titulo_complementar: { outlier_ids: ['o1', 'o2'], titulo_alvo: 'A' } }
  it('sem leitura anterior ou sem marca: pode', () => {
    expect(novidadeTitulo(null, { outlierIds: ['o1'], tituloAlvo: 'A' }).pode).toBe(true)
    expect(novidadeTitulo({}, { outlierIds: ['o1'], tituloAlvo: 'A' }).pode).toBe(true)
  })
  it('mesmos outliers e mesmo título: nega', () => {
    expect(novidadeTitulo(prev, { outlierIds: ['o2', 'o1'], tituloAlvo: 'A' }).pode).toBe(false)
  })
  it('outlier novo ou título trocado: pode', () => {
    expect(novidadeTitulo(prev, { outlierIds: ['o1', 'o3'], tituloAlvo: 'A' }).pode).toBe(true)
    expect(novidadeTitulo(prev, { outlierIds: ['o1', 'o2'], tituloAlvo: 'B' }).pode).toBe(true)
  })
})
