// @vitest-environment node
/**
 * E5B-13 (os dez mundos do mockup 3b) e E5b-18 (200 mundos gerados com semente fixa). Os dez mundos seguem `3b-dados.js` (datas, trocas, testes, origem, ordem),
 * mas as impressões por dia são CONSTANTES escolhidas aqui (o mockup sorteia): os números exatos da seção 13.1 da NOTAS que dependem do sorteio (295, 4,1%...)
 * viram os desta fixture (296 impressões etc.); o que se afirma é a estrutura que a NOTAS fixa: contagem por chip, qual lado é sem número e por quê, as três datas.
 */
import { describe, expect, it } from 'vitest'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import type { VersaoPropria } from '@/lib/youtube/observatorio/proprio-versoes/tipos'
import type { TesteAb } from '@/lib/youtube/observatorio/proprio/ler-testes-ab'
import type { AlcanceCanal } from '@/lib/youtube/observatorio/proprio/tipos'
import { buildTrocas, type TrocaView, type TrocasView } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model'
import { base, comAlcance, dm, entrada, lidas, meio, REG, teste, todasAsFrases, versao, YT } from './proprio-trocas-fixture'

const H13 = '2026-10-13', H17 = '2026-11-17'

/** série de alcance: um relatório por dia de `ini` a `ultFechado` (menos `nm`); linhas só com imp > 0 (dia medido sem linha = zero medido). */
function serie(ini: string, ultFechado: string, imp: (d: string) => number, ctr: (d: string) => number, nm: string[] = []): AlcanceCanal {
  const relatorios: AlcanceCanal['relatorios'] = [], linhas: AlcanceCanal['linhas'] = []
  for (let d = ini; d <= ultFechado; d = addDays(d, 1)) {
    if (nm.includes(d)) continue
    relatorios.push({ dia: d, status: 'baixado', normalizado: true })
    const n = imp(d)
    if (n > 0) linhas.push({ ytId: YT, dia: d, imp: n, ctr: ctr(d) })
  }
  return { canalId: 'canal-1', relatorios, linhas, ultimoRelatorio: ultFechado, descartados: 0 }
}
const vTitulo = (dia: string, over: Partial<VersaoPropria> = {}) => versao({ dia, ...over })
const vThumb = (dia: string, over: Partial<VersaoPropria> = {}) => versao({ dia, campo: 'thumb', texto: null, thumb: { dhash: 'd' + dia, sha256: null, blobUrl: null, imagemExata: true, retoque: false }, ...over })
const ciclos = (id: string, dias: string[]) => dias.map(d => versao({ dia: d, origem: 'ab_lab', eventoAb: 'rotacao', abTestId: id }))
const lidasCom = (vs: VersaoPropria[], a: AlcanceCanal, ts: TesteAb[], thumb: boolean, estado: Parameters<typeof lidas>[2] = {}, desde?: string) => {
  const l = comAlcance(vs, a, desde, { testes: { acesso: 'ok', dado: { testes: ts, descartados: 0 } } })
  if (thumb) l.versoes.videos[0]!.registro.thumb = { estado: 'com_trocas', conferidoAte: l.versoes.estado.estado === 'registrando' ? l.versoes.estado.conferidoAte : null }
  Object.assign(l.versoes.estado, estado)
  return l
}
const trocasDe = (v: TrocasView): TrocaView[] => v.itens.flatMap(i => (i.tipo === 'troca' ? [i.v] : []))
const nTestes = (v: TrocasView) => v.itens.filter(i => i.tipo === 'teste').length
const chips = (v: TrocasView) => Object.fromEntries(v.contagens.map(c => [c.chip, c.n]))
const sem = { negado: false }
void sem

describe('os dez mundos do mockup 3b (E5B-13)', () => {
  it('tipico: 2 trocas e 1 teste; troca 1 com o antes sem dias (teste A/B logo antes) e o depois de 4 dias com 296 impressões; troca 2 sem diferença firme', () => {
    const t1 = teste({ id: 't1', inicio: meio('2026-10-20'), concluidoEm: meio('2026-11-02'), vencedorAplicadoEm: meio('2026-11-03'), ciclos: ['2026-10-20', '2026-10-23', '2026-10-26', '2026-10-29', '2026-11-01'].map(d => ({ inicio: meio(d) })) as never })
    const vs = [base('title'), base('thumb'), ...ciclos('t1', ['2026-10-20', '2026-10-23', '2026-10-26', '2026-10-29', '2026-11-01']), vTitulo('2026-11-03', { origem: 'ab_lab', eventoAb: 'vencedor', abTestId: 't1' }), vThumb('2026-11-09')]
    const v = buildTrocas(entrada(lidasCom(vs, serie('2026-09-22', '2026-11-15', () => 74, d => (d >= '2026-11-10' ? 0.058 : 0.041)), [t1], true), { publicadoEm: '2026-09-22' }))
    const [t, c] = trocasDe(v)
    expect(trocasDe(v)).toHaveLength(2); expect(nTestes(v)).toBe(1)
    expect(t!.antes!.forma).toBe('sem-dias'); expect(t!.antes!.causa).toMatch(/teste A\/B vem logo antes/)
    expect(t!.depois!.rotulo).toContain('4 dias'); expect(t!.depois!.rotulo).toContain('296 impressões')
    // decisão 10 do dono (opção B): a E18 devolve taxa e faixa do lado com 100 impressões ou mais, mesmo sem antes; o chip continua sem veredito
    expect(t!.depois!.taxa).toBe('4,1%'); expect(t!.depois!.forma).toBe('numero'); expect(t!.depois!.faixa).not.toBeNull(); expect(t!.depois!.causa).toBeNull()
    expect(['subiu', 'caiu']).not.toContain(t!.chip)
    expect(c!.chip).toBe('sem-diferenca')
    expect(v.diagnostico).toEqual({ foraDaJanelaSemCausa: 0, fimNaoRegistrado: 0, origemCms: 0, estadoInesperado: 0 })
  })

  it('extremo: 6 trocas e 2 testes; 1 subiu + 4 sem dias + 1 origem não sabida; a troca 2 sobe de 2,8% para 7,5%', () => {
    const ta = teste({ id: 'ta', inicio: meio('2026-10-14'), concluidoEm: meio('2026-10-19'), vencedorAplicadoEm: meio('2026-10-20'), ciclos: ['2026-10-14', '2026-10-16', '2026-10-18'].map(d => ({ inicio: meio(d) })) as never })
    const tb = teste({ id: 'tb', inicio: meio('2026-11-08'), status: 'paused', concluidoEm: null, pausadoEm: meio('2026-11-12'), ciclos: ['2026-11-08', '2026-11-10'].map(d => ({ inicio: meio(d) })) as never })
    const vs = [base('title'), base('thumb'), ...ciclos('ta', ['2026-10-14', '2026-10-16', '2026-10-18']), ...ciclos('tb', ['2026-11-08', '2026-11-10']),
      vTitulo('2026-10-20', { origem: 'ab_lab', eventoAb: 'vencedor', abTestId: 'ta' }), vThumb('2026-10-30'), vTitulo('2026-11-05'), vThumb('2026-11-06'),
      vTitulo('2026-11-12', { origem: 'ab_lab', eventoAb: 'restauro', abTestId: 'tb' }), vThumb('2026-11-14', { origem: 'nao_se_sabe' })]
    const a = serie('2026-08-04', '2026-11-15', () => 3000, d => (d < '2026-10-31' ? 0.028 : d < '2026-11-05' ? 0.075 : 0.06))
    const v = buildTrocas(entrada(lidasCom(vs, a, [ta, tb], true), { publicadoEm: '2026-08-04' }))
    expect(trocasDe(v)).toHaveLength(6); expect(nTestes(v)).toBe(2)
    expect(chips(v)).toEqual({ subiu: 1, 'sem-dias': 4, 'origem-nao-sabida': 1 })
    const t2 = trocasDe(v)[1]!
    expect(t2.antes!.taxa).toBe('2,8%'); expect(t2.depois!.taxa).toBe('7,5%')
    expect(trocasDe(v)[5]!.antes).toBeNull()
  })

  it('hoje: troca 1 com 8 impressões antes e 1 depois, ainda não dá para dizer; troca 2 depois não medido com as três datas (troca + 1, + 3, + 9)', () => {
    const imp = (d: string) => (d === '2026-10-02' ? 2 : 1)
    const vs = [base('title'), base('thumb'), vTitulo('2026-10-09'), vThumb('2026-10-12')]
    const v = buildTrocas(entrada(lidasCom(vs, serie('2026-09-14', '2026-10-11', imp, () => 0.07, ['2026-09-27', '2026-09-28']), [], true, { conferidoAte: H13 }), { publicadoEm: '2026-07-14', hojePt: H13 }))
    const [t1, t2] = trocasDe(v)
    expect(t1!.chip).toBe('ainda-nao-da'); expect(t1!.antes!.rotulo).toContain('8 impressões'); expect(t1!.depois!.rotulo).toContain('1 impressão')
    expect(t2!.chip).toBe('depois-nao-medido'); expect(t2!.depois!.forma).toBe('nao-medido')
    const txt = JSON.stringify(t2)
    for (const d of ['13/10', '15/10', '21/10']) expect(txt).toContain(d)
  })

  it('zero: 0 e 0 impressões e o depois diz "6 dias medidos (…, sem dd/mm)"', () => {
    const vs = [base('title'), vTitulo('2026-10-09')]
    const a = serie('2026-09-21', '2026-10-18', d => (d < '2026-09-28' ? 2 : 0), () => 0.06, ['2026-09-30', '2026-10-15'])
    const v = buildTrocas(entrada(lidasCom(vs, a, [], false, { conferidoAte: '2026-10-20' }), { publicadoEm: '2026-07-14', hojePt: '2026-10-20' }))
    const [t] = trocasDe(v)
    expect(t!.antes!.forma).toBe('zero'); expect(t!.depois!.forma).toBe('zero')
    expect(t!.depois!.rotulo).toMatch(/6 dias medidos \(.*sem 15\/10\)/)
    expect(t!.depois!.rotulo).not.toMatch(/não medido/)
  })

  it('semnumero: sem antes pela publicação; a troca 2 sem dias dos dois lados citando a (1) e a (3); a 3 com o depois não medido', () => {
    const vs = [base('title'), base('thumb'), vTitulo('2026-10-08'), vThumb('2026-10-10'), vTitulo('2026-10-12')]
    const v = buildTrocas(entrada(lidasCom(vs, serie('2026-10-06', '2026-10-11', () => 9, () => 0.05), [], true, { desde: REG }), { publicadoEm: '2026-10-06', hojePt: H13 }))
    const [t1, t2, t3] = trocasDe(v)
    expect(t1!.antes!.forma).toBe('sem-antes'); expect(t1!.antes!.causa).toBe('o vídeo saiu logo antes da troca')
    expect(t2!.antes!.forma).toBe('sem-dias'); expect(t2!.depois!.forma).toBe('sem-dias')
    expect(t2!.frase).toContain('(1)'); expect(t2!.frase).toContain('(3)')
    expect(t3!.depois!.forma).toBe('nao-medido'); expect(t3!.frase).toMatch(/13\/10/)
  })

  it('so-teste: 0 trocas e 1 teste em andamento que começou antes do registro (faixa aberta e faixa antes do registro)', () => {
    const ts = teste({ id: 'ts', inicio: meio('2026-10-03'), status: 'active', concluidoEm: null, ciclos: ['2026-10-03', '2026-10-06', '2026-10-09', '2026-10-12'].map(d => ({ inicio: meio(d) })) as never })
    const v = buildTrocas(entrada(lidasCom([base('title')], serie('2026-09-14', '2026-10-11', () => 1, () => 0.07), [ts], false, { conferidoAte: H13 }), { publicadoEm: '2026-07-14', hojePt: H13 }))
    expect(v.zero).toBe(true); expect(nTestes(v)).toBe(1)
    const ab = v.faixas.find(f => f.k === 'ab')!
    expect(ab).toMatchObject({ k: 'ab', de: '2026-10-03', ate: null })
    expect(v.faixas.some(f => f.k === 'reg')).toBe(true)
    expect(v.topo.partes.map(p => p.t).join('')).toContain('em andamento')
  })

  it('so-reconstruido: nenhuma troca e a faixa reconstruída com "ciclo 1 de 4" a "ciclo 4 de 4" e "antes do teste · título original"', () => {
    const cs = ['2026-05-31', '2026-06-02', '2026-06-04', '2026-06-06']
    const t = teste({ id: 'tp', inicio: meio('2026-05-31'), concluidoEm: meio('2026-06-07'), ciclos: cs.map(d => ({ inicio: meio(d) })) as never })
    const pre = (texto: string, desde: string, i: number) => versao({ dia: desde, texto, preRegistro: true, origem: 'ab_lab', abTestId: 'tp', vistaDesde: i < 0 ? '2026-05-30T10:00:00.000Z' : meio(cs[i]!), corrente: false })
    const vs = [base('title'), pre('Bali ou Tailândia: qual é mais barata?', '2026-05-30', -1), ...cs.map((d, i) => pre('Titulo ' + i, d, i))]
    const v = buildTrocas(entrada(lidasCom(vs, serie('2026-09-14', '2026-10-11', () => 1, () => 0.07), [t], false, { conferidoAte: H13 }), { publicadoEm: '2026-05-18', hojePt: H13 }))
    expect(v.zero).toBe(true)
    const linhas = v.reconstruida!.linhas.join('\n')
    for (let i = 1; i <= 4; i++) expect(linhas).toContain(`ciclo ${i} de 4`)
    expect(linhas).toContain('antes do teste · título original')
    expect(v.reconstruida!.selos).toContain('sem antes e depois')
  })

  it('vazio: "Nenhuma troca registrada desde dd/mm/aaaa, quando o registro deste vídeo começou."', () => {
    const v = buildTrocas(entrada(lidasCom([base('title')], serie('2026-09-14', '2026-10-11', () => 1, () => 0.07), [], false, { conferidoAte: H13 }), { publicadoEm: '2026-07-14', hojePt: H13 }))
    expect(v.zero).toBe(true); expect(v.frase).toContain('Nenhuma troca registrada desde 07/10/2026')
    expect(v.atraso).toBeNull()
  })

  it('erro: a linha do topo com "até 11/10" e o aviso de atraso', () => {
    const vs = [base('title'), vTitulo('2026-10-09')]
    const v = buildTrocas(entrada(lidasCom(vs, serie('2026-09-14', '2026-10-11', () => 5, () => 0.07), [], false, { atrasoDias: 2, conferidoAte: '2026-10-11' }), { publicadoEm: '2026-07-14', hojePt: H13 }))
    expect(v.topo.aviso).toContain('11/10'); expect(v.atraso).not.toBeNull()
    expect(trocasDe(v)).toHaveLength(1)
  })

  it('leitura (negado): só o bloqueio, sem título, data nem taxa', () => {
    const v = buildTrocas(entrada('negado'))
    expect(v.estado).toBe('privado'); expect(v.bloqueio).not.toBeNull()
    expect(v.itens).toEqual([]); expect(v.faixas).toEqual([]); expect(v.marcas).toEqual([])
    expect(todasAsFrases(v)).not.toMatch(/\d{2}\/\d{2}|\d,\d%/)
  })
})

// ------------------------------------------------------------------------------------------------------------------------------------
// 200 mundos gerados com semente fixa
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const ORIGENS = ['fora_do_sistema', 'fora_do_sistema', 'nao_se_sabe', 'ab_lab'] as const

describe('200 mundos gerados com semente fixa (E5b-18)', () => {
  const N = 200
  const mundos = Array.from({ length: N }, (_, i) => {
    const r = mulberry32(20261016 + i)
    const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1))
    const hoje = H17
    const nT = int(0, 6)
    const dias = new Set<string>()
    while (dias.size < nT) dias.add(addDays(hoje, -int(0, 40)))
    const vs: VersaoPropria[] = [base('title'), base('thumb')]
    const usadas = new Set<string>()
    for (const d of [...dias].sort()) {
      const o = ORIGENS[int(0, ORIGENS.length - 1)]!
      const campo = r() < 0.5 ? 'title' : 'thumb'
      const mk = campo === 'title' ? vTitulo : vThumb
      vs.push(mk(d, o === 'ab_lab' ? { origem: 'ab_lab', eventoAb: r() < 0.5 ? 'vencedor' : 'restauro', abTestId: 'tx' } : { origem: o }))
      usadas.add(d)
    }
    const nTestes = int(0, 2)
    const ts: TesteAb[] = Array.from({ length: nTestes }, (_, k) => {
      const ini = addDays(hoje, -int(10, 60))
      const st = (['active', 'completed', 'paused', 'archived'] as const)[int(0, 3)]!
      return teste({ id: k === 0 ? 'tx' : 'ty', inicio: meio(ini), status: st, concluidoEm: st === 'completed' ? meio(addDays(ini, int(1, 8))) : null, pausadoEm: st === 'paused' ? meio(addDays(ini, int(1, 8))) : null,
        ciclos: Array.from({ length: int(0, 4) }, (_, c) => ({ inicio: meio(addDays(ini, c * 2)) })) as never })
    })
    const ult = addDays(hoje, -2)
    const nm = Array.from({ length: int(0, 3) }, () => addDays(hoje, -int(2, 30)))
    // portão L5 (Yannis I1): as impressões são sorteadas POR LADO de um dia de corte, para os dois lados de uma troca poderem diferir muito
    const sorteio = () => (int(0, 4) === 0 ? 0 : int(5, 400))
    const impAntesDoCorte = sorteio(), impDepoisDoCorte = r() < 0.5 ? sorteio() : int(500, 5000)
    const corte = addDays(hoje, -int(5, 35))
    const a = serie(addDays(hoje, -int(20, 60)), ult, d => (d < corte ? impAntesDoCorte : impDepoisDoCorte), () => 0.02 + r() * 0.06, nm)
    const atraso = int(0, 3)
    const l = lidasCom(vs, a, ts, true, { atrasoDias: atraso, conferidoAte: addDays(hoje, -atraso) })
    const publicadoEm = addDays(hoje, -int(8, 120))
    return { l, publicadoEm, vs, ts, a, atraso }
  })

  it('nenhum mundo lança; as contagens somam o número de trocas; os números e datas só vêm da entrada', () => {
    const permitidas = new Set<string>()
    for (let k = -140; k <= 10; k++) permitidas.add(dm(addDays(H17, k)))
    permitidas.add(dm(REG))
    for (const m of mundos) {
      const v = buildTrocas(entrada(m.l, { publicadoEm: m.publicadoEm }))
      const nT = trocasDe(v).length
      expect(v.contagens.reduce((s, c) => s + c.n, 0), 'contagens').toBe(nT)
      expect(v.zero).toBe(nT === 0)
      expect(v.diagnostico.estadoInesperado).toBe(0)
      const json = todasAsFrases(v)
      expect(json).not.toMatch(/efeito|causou|por causa|fez subir|trocado pelo CMS|undefined|NaN/i)
      for (const x of json.matchAll(/(?<![\d/])\d{2}\/\d{2}(?!\d)/g)) expect(permitidas.has(x[0]), x[0] + ' em ...' + json.slice(Math.max(0, x.index! - 80), x.index! + 20)).toBe(true)
      // o número de uma taxa só existe com lado com número; lado sem número nunca leva barra
      for (const t of trocasDe(v)) for (const lado of [t.antes, t.depois]) {
        if (!lado) continue
        if (lado.forma !== 'numero') { expect(lado.taxa).toBeNull(); expect(lado.barra).toBeNull() }
        else { expect(lado.taxa).not.toBeNull(); expect(lado.barra!.lo).toBeLessThanOrEqual(lado.barra!.hi) }
      }
      // causa pelo OUTRO lado: se o texto diz que o outro lado não tem dia, o outro lado realmente não tem
      for (const t of trocasDe(v)) for (const [lado, outro] of [[t.antes, t.depois], [t.depois, t.antes]] as const) {
        if (lado?.causa?.includes('não tem dia')) expect(['nao-medido', 'sem-antes', 'sem-dias', 'cortado'], lado.causa).toContain(outro?.forma)
        if (lado?.causa?.includes('o outro lado tem só')) expect(outro?.forma, lado.causa).toBe('poucas')
      }
      // atraso: com 2 dias ou mais, aviso; com menos, nenhum
      expect(v.atraso !== null).toBe(m.atraso >= 2)
    }
  })

  it('os mundos têm variedade: com e sem troca, com lado com número e lado sem número, com e sem teste', () => {
    const vs = mundos.map(m => buildTrocas(entrada(m.l, { publicadoEm: m.publicadoEm })))
    expect(vs.filter(v => trocasDe(v).length > 0).length).toBeGreaterThan(100)
    expect(vs.filter(v => v.zero).length).toBeGreaterThan(5)
    expect(vs.some(v => trocasDe(v).some(t => t.antes?.forma === 'numero'))).toBe(true)
    expect(vs.some(v => trocasDe(v).some(t => t.antes && t.antes.forma !== 'numero'))).toBe(true)
    expect(vs.some(v => nTestes(v) > 0)).toBe(true)
  })

  it('marcas: uma por troca, no dia da troca; faixas ab: uma por teste lido; o mesmo mundo dá a mesma vista (determinismo)', () => {
    for (const m of mundos.slice(0, 40)) {
      const v = buildTrocas(entrada(m.l, { publicadoEm: m.publicadoEm }))
      expect(v.marcas).toHaveLength(trocasDe(v).length)
      expect(v.faixas.filter(f => f.k === 'ab')).toHaveLength(nTestes(v))
      expect(JSON.stringify(buildTrocas(entrada(m.l, { publicadoEm: m.publicadoEm })))).toBe(JSON.stringify(v))
    }
  })
})
