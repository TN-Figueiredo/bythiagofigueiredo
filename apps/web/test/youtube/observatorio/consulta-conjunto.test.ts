// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { montarConjunto } from '@/lib/youtube/observatorio/consulta/conjunto'
import { METRICAS_DA_CONSULTA } from '@/lib/youtube/observatorio/consulta/catalogo'
import { RULES } from '@/lib/youtube/observatorio/rules'
import { m7Taxa, mundo } from './consulta-fixture'
import { naoMedido } from '@/lib/youtube/observatorio/medidas/tipos'

const DIR = path.resolve(__dirname, '../../../src/lib/youtube/observatorio/consulta')
const todas = (r: ReturnType<typeof montarConjunto>) => [...r.longos, ...r.shorts]
const achar = (r: ReturnType<typeof montarConjunto>, id: string) => todas(r).find(l => l.id === id)!

describe('catalogo', () => {
  it('cada métrica aponta para o que o motor guarda e só vpd7 e multiplicador pedem acompanhado', () => {
    expect(Object.keys(METRICAS_DA_CONSULTA).sort()).toEqual(['comentarios', 'engajamento', 'inscritos', 'likes', 'multiplicador', 'views', 'vpd7'])
    expect(Object.entries(METRICAS_DA_CONSULTA).filter(([, m]) => m.soAcompanhados).map(([k]) => k).sort()).toEqual(['multiplicador', 'vpd7'])
  })
})

describe('montarConjunto', () => {
  it('(a) tracked:false: vpd7 e multiplicador saem nao_medido, views medido (§7 teste 15)', () => {
    const { entrada, p } = mundo(ds => { ds.videos.find(v => v.id === 'luke-damant-l71')!.views = 5000 })
    const l = achar(montarConjunto(p, entrada), 'luke-damant-l71')
    expect(l.celulas.views).toMatchObject({ estado: 'medido', x: 5000 })
    for (const m of ['vpd7', 'multiplicador'] as const) expect(l.celulas[m]).toMatchObject({ estado: 'nao_medido', x: null, causa: 'fora dos vídeos acompanhados' })
    expect(l.baseFraca).toBe(false)
  })

  it('(b) curtidas pela regra única: 0 sem sinalizador e oculto são nao_medido; false com 0 é zero medido (§7 teste 8)', () => {
    const ids = ['luke-damant-l1', 'luke-damant-l2', 'luke-damant-l3']
    const { entrada, p } = mundo(
      ds => { for (const id of ids) ds.videos.find(v => v.id === id)!.likes = 0; ds.videos.find(v => v.id === 'luke-damant-l1')!.comments = 0 },
      { info: { 'luke-damant-l1': { likesHidden: null, commentsDisabled: null }, 'luke-damant-l2': { likesHidden: true }, 'luke-damant-l3': { likesHidden: false } } },
    )
    const r = montarConjunto(p, entrada)
    expect(achar(r, ids[0]!).celulas.likes).toMatchObject({ estado: 'nao_medido', x: null })
    expect(achar(r, ids[0]!).celulas.comentarios).toMatchObject({ estado: 'nao_medido', x: null })
    expect(achar(r, ids[1]!).celulas.likes).toMatchObject({ estado: 'nao_medido', x: null, causa: 'curtidas ocultas pelo canal' })
    expect(achar(r, ids[2]!).celulas.likes).toMatchObject({ estado: 'zero_medido', x: 0 })
    expect(fs.readFileSync(path.join(DIR, 'conjunto.ts'), 'utf8')).toMatch(/reacaoComEstado/)
  })

  it('(c) formato todos: dois blocos disjuntos que somam o conjunto; longos só traz longos (§7 teste 10)', () => {
    const { entrada, p } = mundo()
    const r = montarConjunto(p, entrada)
    expect(r.longos.length).toBeGreaterThan(0); expect(r.shorts.length).toBeGreaterThan(0)
    expect(r.longos.every(l => l.formato === 'longos')).toBe(true)
    expect(r.shorts.every(l => l.formato === 'shorts')).toBe(true)
    expect(new Set(todas(r).map(l => l.id)).size).toBe(r.longos.length + r.shorts.length)
    const soLongos = montarConjunto({ ...p, formato: 'longos' }, entrada)
    expect(soLongos.shorts).toEqual([]); expect(soLongos.longos.map(l => l.id)).toEqual(r.longos.map(l => l.id))
    const pool = entrada.obs.videos.filter(v => !entrada.obs.channel(v.ch)!.own)
    expect(r.longos.length + r.shorts.length).toBe(pool.length)
  })

  it('(d) marcados com 3 ids: só esses 3 (§7 teste 5, parte do conjunto)', () => {
    const { entrada, p } = mundo()
    const ids = ['luke-damant-l1', 'luke-damant-s0', 'dale-philip-s0']
    const r = montarConjunto({ ...p, lugar: 'local:vn-hanoi' }, { ...entrada, marcados: new Set(ids) })
    expect(todas(r).map(l => l.id).sort()).toEqual([...ids].sort())
    expect(todas(montarConjunto({ ...p, lugar: 'local:vn-hanoi' }, { ...entrada, marcados: new Set() }))).toEqual([])
  })

  it('(e) agendado ou ao vivo: engajamento nao_medido "agendado ou ao vivo", fora de qualquer número', () => {
    const { entrada, p } = mundo(undefined, {
      m7: { 'luke-damant-l1': m7Taxa(0.02), 'luke-damant-l2': naoMedido('fecha_em') },
      info: { 'luke-damant-l1': { wasLive: true } },
    })
    const r = montarConjunto(p, entrada)
    expect(achar(r, 'luke-damant-l1').celulas.engajamento).toMatchObject({ estado: 'nao_medido', x: null, causa: 'agendado ou ao vivo' })
    expect(achar(r, 'luke-damant-l2').celulas.engajamento).toMatchObject({ estado: 'nao_medido', x: null, causa: 'agendado ou ao vivo' })
  })

  it('engajamento medido vai por mil views com a base; leitura falhou é falhou, nunca nao_medido', () => {
    const { entrada, p } = mundo(undefined, { m7: { 'luke-damant-l1': m7Taxa(0.0125), 'luke-damant-l2': m7Taxa(0.03, 'total_de_hoje'), 'luke-damant-l3': naoMedido('leitura_falhou') } })
    const r = montarConjunto(p, entrada)
    expect(achar(r, 'luke-damant-l1').celulas.engajamento).toMatchObject({ estado: 'medido', x: 12.5, base: 'idade_30' })
    expect(achar(r, 'luke-damant-l2').celulas.engajamento).toMatchObject({ x: 30, base: 'total_de_hoje' })
    expect(achar(r, 'luke-damant-l3').celulas.engajamento).toMatchObject({ estado: 'falhou', x: null })
    expect(achar(r, 'luke-damant-l3').celulas.engajamento!.causa).toBeTruthy()
  })

  it('(f) subs nulo: inscritos nao_medido com a causa; com número, medido', () => {
    const { entrada, p } = mundo(ds => { ds.channels.find(c => c.id === 'luke-damant')!.subs = null })
    const r = montarConjunto(p, entrada)
    expect(achar(r, 'luke-damant-l1').celulas.inscritos).toMatchObject({ estado: 'nao_medido', x: null, causa: 'inscritos ocultos ou não lidos' })
    expect(achar(r, 'dale-philip-s0').celulas.inscritos).toMatchObject({ estado: 'medido', x: 3720000 })
  })

  it('(g) fuso de São Paulo: 23:30 BRT de 31/10 (02:30 UTC de 01/11) entra em publicado_ate 2026-10-31 (Foco 3)', () => {
    const quando = Date.parse('2026-11-01T02:30:00Z')
    const { entrada, p } = mundo(ds => { ds.videos.find(v => v.id === 'luke-damant-l1')!.pub = quando })
    const dentro = montarConjunto({ ...p, publicadoAte: '2026-10-31', publicadoDe: '2026-10-31' }, entrada)
    expect(todas(dentro).map(l => l.id)).toEqual(['luke-damant-l1'])
    expect(todas(montarConjunto({ ...p, publicadoDe: '2026-11-01' }, entrada)).map(l => l.id)).not.toContain('luke-damant-l1')
    expect(todas(montarConjunto({ ...p, publicadoAte: '2026-10-30' }, entrada)).map(l => l.id)).not.toContain('luke-damant-l1')
  })

  it('(h) formato nulo: formatoConfirmado false, motivo, fica no bloco de longos (Foco 4)', () => {
    const { entrada, p } = mundo(ds => { ds.videos.find(v => v.id === 'luke-damant-l1')!.isShort = null })
    const r = montarConjunto(p, entrada)
    const l = r.longos.find(x => x.id === 'luke-damant-l1')!
    expect(l).toBeTruthy()
    expect(l.formatoConfirmado).toBe(false)
    expect(l.motivos).toContain('formato não confirmado')
    expect(r.longos.find(x => x.id === 'luke-damant-l2')!.formatoConfirmado).toBe(true)
  })

  it('(i) vpd com 3 dias de idade: vpdBase desde_publicacao; vpd7 com 40 dias: 7d; sem série: causa escrita', () => {
    const { entrada, p, obs } = mundo()
    const r = montarConjunto(p, entrada)
    const novo = obs.videos.find(v => v.tracked && v.vpd7 == null && v.vpd != null && v.ageDays <= 7 && !obs.channel(v.ch)!.own)!
    const velho = obs.videos.find(v => v.tracked && v.vpd7 != null && v.ageDays >= 40 && !obs.channel(v.ch)!.own)!
    const a = achar(r, novo.id).celulas.vpd7!
    expect(a).toMatchObject({ estado: 'medido', vpdBase: 'desde_publicacao', x: novo.vpd })
    expect(a.causa).toMatch(/menos de 7 dias de série/)
    expect(achar(r, velho.id).celulas.vpd7).toMatchObject({ estado: 'medido', vpdBase: '7d', x: velho.vpd7 })
    const sem = obs.videos.find(v => v.tracked && v.vpd7 == null && v.vpd == null && !obs.channel(v.ch)!.own)
    if (sem) expect(achar(r, sem.id).celulas.vpd7).toMatchObject({ estado: 'nao_medido', x: null, causa: expect.any(String) })
  })

  it('(i2) canal atrasado ou com erro: motivo "última leitura dd/mm" (ou sem leitura boa)', () => {
    const { entrada, p, obs } = mundo()
    const r = montarConjunto(p, entrada)
    const atrasado = obs.videos.find(v => v.ch === 'paddy-doyle')!
    const ch = obs.channel('paddy-doyle')!
    expect(achar(r, atrasado.id).motivos.some(m => m.startsWith('última leitura ') || m === 'sem leitura boa do canal')).toBe(true)
    if (ch.sync.last != null) expect(achar(r, atrasado.id).motivos).toContain('última leitura ' + obs.date.dm(ch.sync.last))
    const ok = obs.videos.find(v => v.ch === 'luke-damant')!
    expect(achar(r, ok.id).motivos.some(m => m.startsWith('última leitura'))).toBe(false)
  })

  it('(j) missingSince: motivo "saiu do YouTube em dd/mm", o vídeo fica no conjunto', () => {
    const ms = Date.parse('2026-10-20T12:00:00Z')
    const { entrada, p } = mundo(undefined, { info: { 'luke-damant-l1': { missingSince: ms } } })
    const l = achar(montarConjunto(p, entrada), 'luke-damant-l1')
    expect(l.motivos).toContain('saiu do YouTube em 20/10')
  })

  it('(k) estado vem do motor (arquivo) e ativo é o padrão', () => {
    const { entrada, p } = mundo(ds => {
      ds.videos.find(v => v.id === 'luke-damant-l1')!.arquivo = { estado: 'leitura_mensal', desde: 1 }
      ds.videos.find(v => v.id === 'luke-damant-l2')!.arquivo = { estado: 'no_arquivo', desde: 1 }
    })
    const r = montarConjunto(p, entrada)
    expect(achar(r, 'luke-damant-l1').estado).toBe('leitura_mensal')
    expect(achar(r, 'luke-damant-l2').estado).toBe('so_no_arquivo')
    expect(achar(r, 'luke-damant-l3').estado).toBe('ativo')
  })

  it('(l) varredura: o módulo não importa multiplierAt, loadRows nem leitores crus, e não faz conta própria', () => {
    for (const f of ['conjunto.ts', 'catalogo.ts', 'tipos.ts']) {
      const src = fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')
      expect(src, f).not.toMatch(/multiplierAt|loadRows|lerVideosDoCanal|lerMarcasDoCanal|extrairLugares|medidasDoCanal/)
      expect(src, f).not.toMatch(/median\(|quant\(/)
    }
  })

  it('(m) canal agendado para apagar: o vídeo continua no conjunto, com o motivo', () => {
    const { entrada, p } = mundo(ds => { ds.channels.find(c => c.id === 'luke-damant')!.removalRequestedAt = '2026-10-20T00:00:00Z' })
    const sem = mundo()
    const r = montarConjunto(p, entrada)
    expect(todas(r).map(l => l.id)).toEqual(todas(montarConjunto(sem.p, sem.entrada)).map(l => l.id))
    expect(achar(r, 'luke-damant-l1').motivos).toContain('canal agendado para apagar')
  })

  it('canal que não carregou: curtidas, comentários e engajamento "não medido: <causa>"; views e vpd7 seguem', () => {
    const { entrada, p } = mundo(undefined, { naoCarregou: { 'luke-damant': 'tempo_esgotado' } })
    const l = achar(montarConjunto(p, entrada), 'luke-damant-l1')
    for (const m of ['likes', 'comentarios', 'engajamento'] as const) expect(l.celulas[m]).toMatchObject({ estado: 'nao_medido', x: null, causa: expect.stringContaining('tempo_esgotado') })
    expect(l.celulas.views!.estado).toMatch(/medido/)
  })

  it('MedidasDoSite sem videos (nada trouxe os sinalizadores): curtidas nao_medido, nunca zero inventado', () => {
    const { entrada, p } = mundo(ds => { ds.videos.find(v => v.id === 'luke-damant-l1')!.likes = 0 }, { semVideos: true })
    expect(achar(montarConjunto(p, entrada), 'luke-damant-l1').celulas.likes).toMatchObject({ estado: 'nao_medido', x: null })
  })

  it('paridade com a Outliers: mesmos ids e valores nas linhas de base sólida com ×2 ou mais (§7 teste 1, parte do conjunto)', () => {
    const { entrada, p, obs } = mundo()
    const o = obs.outliers({ niche: 'todos', fmt: 'long', ages: ['0-30'], min: RULES.outlierMin }).items
    const r = montarConjunto({ ...p, formato: 'longos', janelaIdade: ['0-30'] }, entrada)
    const sol = r.longos.filter(l => l.celulas.multiplicador?.x != null && !l.baseFraca && l.celulas.multiplicador.x >= RULES.outlierMin)
    expect(new Set(sol.map(l => l.id))).toEqual(new Set(o.filter(i => !i.weak).map(i => i.id)))
    for (const i of o.filter(x => !x.weak)) expect(achar(r, i.id).celulas.multiplicador!.x).toBe(i.mult.value)
  })
})
