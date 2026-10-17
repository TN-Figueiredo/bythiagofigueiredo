// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { addDays, dayPt } from '@/lib/youtube/coleta/day-pt'
import { PROPRIO_RULES } from '@/lib/youtube/observatorio/proprio-versoes/regras'
import type { VersaoPropria, VersoesCanal } from '@/lib/youtube/observatorio/proprio-versoes/tipos'
import type { TesteAb } from '@/lib/youtube/observatorio/proprio/ler-testes-ab'
import type { AlcanceCanal, RelatorioDia } from '@/lib/youtube/observatorio/proprio/tipos'
import type { TrocasLidas } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-trocas'
import { trocasQueContam as trocasQueContamDoTeste } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas-contam'
import { buildTrocas, causaSemTaxa, SEM_RELATORIO, type EntradaTrocas, type TrocasView } from '@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model'

const YT = 'abcdefghijk', C = 'canal-1'
const HOJE = '2026-11-17'
const REG = '2026-10-07'
const dm = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)
const dmy = (d: string) => dm(d) + '/' + d.slice(0, 4)
const salvo = { ...PROPRIO_RULES }
afterEach(() => { Object.assign(PROPRIO_RULES, salvo) })

const meio = (d: string): string => `${d}T20:00:00.000Z`
let seq = 0
function versao(over: Partial<VersaoPropria> & { dia?: string } = {}): VersaoPropria {
  const { dia = '2026-11-03', ...resto } = over
  seq++
  return {
    id: 'v' + seq, ytId: YT, campo: 'title', texto: 'TITULO-' + seq, hash: 'h' + seq, thumb: null, primeiroDia: dia, ultimoDia: dia,
    vistaDesde: meio(dia), vistaAte: meio(dia), janela: { de: meio(addDays(dia, -1)), ate: meio(dia) }, precisao: '1d',
    origem: 'fora_do_sistema', eventoAb: null, abTestId: null, abVariantId: null, preRegistro: false, corrente: true, ...resto,
  }
}
const base = (campo: 'title' | 'thumb' = 'title') => versao({ campo, dia: REG, origem: 'linha_de_base', janela: null, primeiroDia: REG })
function canal(versoes: VersaoPropria[], estado: Partial<{ atrasoDias: number; conferidoAte: string; desde: string }> = {}): VersoesCanal {
  return {
    canalId: C, estado: { estado: 'registrando', desde: REG, conferidoAte: HOJE, atrasoDias: 0, ...estado },
    videos: [{ ytId: YT, versoes, registro: { title: { estado: 'com_trocas', conferidoAte: HOJE }, thumb: { estado: 'sem_versao', conferidoAte: null }, desc: { estado: 'sem_versao', conferidoAte: null } } }],
  }
}
/** Alcance com um dia a cada dia de `de` a `ate`, imp e taxa fixos (`ausentes`: dias sem linha mas com relatório = zero medido). */
function alcance(de: string, ate: string, imp = 1000, ctr = 0.05, extra: Partial<AlcanceCanal> = {}): AlcanceCanal {
  const relatorios: RelatorioDia[] = [], linhas: AlcanceCanal['linhas'] = []
  for (let d = de; d <= ate; d = addDays(d, 1)) {
    relatorios.push({ dia: d, status: 'baixado', normalizado: true })
    if (imp > 0) linhas.push({ ytId: YT, dia: d, imp, ctr })
  }
  return { canalId: C, relatorios, linhas, ultimoRelatorio: ate, descartados: 0, ...extra }
}
const testeVazio: TrocasLidas['testes'] = { acesso: 'ok', dado: { testes: [], descartados: 0 } }
function lidas(versoes: VersaoPropria[], over: Partial<TrocasLidas> = {}, estado: Parameters<typeof canal>[1] = {}): TrocasLidas {
  return { versoes: canal(versoes, estado), testes: testeVazio, motivoTestes: null, alcance: null, ...over }
}
function entrada(l: TrocasLidas | 'negado' | 'erro', over: Partial<EntradaTrocas> = {}): EntradaTrocas {
  return {
    lidas: l === 'negado' ? { acesso: 'negado' } : l === 'erro' ? { acesso: 'erro' } : { acesso: 'ok', dado: l }, ytId: YT, publicadoEm: '2026-09-22', hojePt: HOJE, podeEditar: true,
    dm, dmy, quandoSp: iso => ({ dia: dm(iso.slice(0, 10)), hora: '02:00' }), diaPt: iso => dayPt(new Date(iso)), n: x => String(x), ...over,
  }
}
const comAlcance = (versoes: VersaoPropria[], a: AlcanceCanal, desde = addDays(HOJE, -60), extra: Partial<TrocasLidas> = {}) =>
  lidas(versoes, { alcance: { acesso: 'ok', dado: { alcance: a, desde, primeiroRelatorio: a.relatorios[0]?.dia ?? null } }, ...extra })
const teste = (over: Partial<TesteAb> = {}): TesteAb => ({ id: 't1', tipo: 'title', inicio: meio('2026-10-20'), pausadoEm: null, concluidoEm: meio('2026-11-02'), motivo: null, vencedorAplicadoEm: null, tituloOriginal: null, ciclos: [], status: 'completed', ...over })
const todasAsFrases = (v: TrocasView): string => JSON.stringify(v)

describe('estado do bloco', () => {
  it('negado: só o bloqueio, e a vista não leva título, data nem taxa', () => {
    const v = buildTrocas(entrada('negado'))
    expect(v.estado).toBe('privado')
    expect(v.bloqueio).not.toBeNull()
    expect(v.itens).toEqual([]); expect(v.faixas).toEqual([]); expect(v.marcas).toEqual([])
    expect(v.diagnostico).toEqual({ foraDaJanelaSemCausa: 0, fimNaoRegistrado: 0, origemCms: 0, estadoInesperado: 0 })
    expect(JSON.stringify(v)).not.toMatch(/\d{2}\/\d{2}|%/)
  })
  it('erro de leitura: a nota do gráfico e nenhuma marca', () => {
    const v = buildTrocas(entrada('erro'))
    expect(v.estado).toBe('erro-de-leitura')
    expect(v.notaGrafico).toBe('As trocas não puderam ser lidas: o gráfico está sem as marcas.')
    expect(v.marcas).toEqual([])
  })
  it('schema_ausente, sem_estado e título e thumbnail sem versão: nao-registrado, nenhuma data, nota do gráfico', () => {
    for (const estado of [{ estado: 'schema_ausente' as const }, { estado: 'sem_estado' as const }]) {
      const l = lidas([]); l.versoes = { ...l.versoes, estado }
      const v = buildTrocas(entrada(l))
      expect(v.estado).toBe('nao-registrado'); expect(v.motivo).toBe('nao_registrado'); expect(v.notaGrafico).toBe('trocas não registradas')
      expect(JSON.stringify(v)).not.toMatch(/\d{2}\/\d{2}/)
    }
    const l = lidas([]); l.versoes.videos[0]!.registro.title = { estado: 'sem_versao', conferidoAte: null }
    expect(buildTrocas(entrada(l)).estado).toBe('nao-registrado')
  })
})

describe('vazio e só teste', () => {
  it('vazio: "Nenhuma troca registrada desde dd/mm/aaaa, quando o registro deste vídeo começou." e a caixa 0', () => {
    const v = buildTrocas(entrada(lidas([base()]), { publicadoEm: '2026-08-01' }))
    expect(v.estado).toBe('ok'); expect(v.zero).toBe(true)
    expect(v.frase).toBe(`Nenhuma troca registrada desde ${dmy(REG)}, quando o registro deste vídeo começou.`)
    expect(v.topo.partes.map(p => p.t).join('')).toBe(`Trocas deste vídeo: nenhuma desde ${dm(REG)}.`)
    expect(v.topo.linkAntesDepois).toBe(false)
  })
  it('linha de base 2 dias depois da publicação: "desde a publicação"; 3 dias depois: "desde dd/mm" (fronteira)', () => {
    const b = (d: string) => { const x = base(); x.primeiroDia = d; return x }
    expect(buildTrocas(entrada(lidas([b('2026-09-24')]), { publicadoEm: '2026-09-22' })).frase).toContain('desde a publicação (22/09)')
    expect(buildTrocas(entrada(lidas([b('2026-09-25')]), { publicadoEm: '2026-09-22' })).frase).toContain('quando o registro deste vídeo começou')
  })
  it('só teste em andamento: "0 trocas fora do A/B Lab ... em andamento, que não conta como troca"', () => {
    const l = lidas([base()], { testes: { acesso: 'ok', dado: { testes: [teste({ status: 'active', concluidoEm: null, inicio: meio('2026-10-03') })], descartados: 0 } } })
    const v = buildTrocas(entrada(l))
    expect(v.frase).toBe(`0 trocas fora do A/B Lab desde ${dmy(REG)} e 1 teste A/B em andamento, que não conta como troca.`)
    expect(v.faixas.find(f => f.k === 'ab')).toMatchObject({ de: '2026-10-03', ate: null })
    expect(v.faixas.find(f => f.k === 'reg')).toMatchObject({ ate: addDays(REG, -1) })
  })
  it('estados do teste: active, paused, completed (menor das duas), archived sem datas (fim não registrado, conta no diagnóstico)', () => {
    const t = (o: Partial<TesteAb>) => buildTrocas(entrada(lidas([base()], { testes: { acesso: 'ok', dado: { testes: [teste(o)], descartados: 0 } } })))
    expect(t({ status: 'active', concluidoEm: null }).itens[0]).toMatchObject({ v: { fim: 'andamento', andamento: true, ate: null } })
    expect(t({ status: 'paused', pausadoEm: meio('2026-10-25'), concluidoEm: null }).itens[0]).toMatchObject({ v: { fim: 'registrado', ate: '2026-10-25' } })
    expect(t({ status: 'completed', pausadoEm: meio('2026-10-30'), concluidoEm: meio('2026-11-02') }).itens[0]).toMatchObject({ v: { fim: 'registrado', ate: '2026-10-30' } })
    const a = t({ status: 'archived', concluidoEm: null, ciclos: [{ n: 1, inicio: meio('2026-10-22'), fim: null }] })
    expect(a.itens[0]).toMatchObject({ v: { fim: 'nao-registrado', ate: '2026-10-22', andamento: false } })
    expect(a.diagnostico.fimNaoRegistrado).toBe(1)
    expect(a.frase).not.toContain('em andamento')
  })
  it('M-1: teste concluído com 1 ciclo diz "A troca de ciclo", nunca "As 1 trocas"', () => {
    const v = buildTrocas(entrada(lidas([base()], { testes: { acesso: 'ok', dado: { testes: [teste({ ciclos: [{ n: 1, inicio: meio('2026-10-22'), fim: null }] })], descartados: 0 } } })))
    const f = (v.itens[0] as { v: { frase: string } }).v.frase
    expect(f).toMatch(/^A troca de ciclo não entra aqui\./)
    expect(f).not.toMatch(/As 1 /)
  })
  it('teste às 05:00 UTC começa no dia do Pacífico (a véspera do dia UTC)', () => {
    const v = buildTrocas(entrada(lidas([base()], { testes: { acesso: 'ok', dado: { testes: [teste({ inicio: '2026-10-21T05:00:00.000Z' })], descartados: 0 } } })))
    expect(v.itens[0]).toMatchObject({ v: { de: '2026-10-20' } })
  })
  it('Lab em erro: nenhuma faixa ab e o aviso; Lab sem teste: nenhuma faixa e nenhum aviso (não li x não há)', () => {
    const erro = buildTrocas(entrada(lidas([base()], { testes: { acesso: 'erro' }, motivoTestes: 'banco' })))
    expect(erro.faixas.filter(f => f.k === 'ab')).toEqual([]); expect(erro.avisos.join(' ')).toContain('A/B Lab')
    const teto = buildTrocas(entrada(lidas([base()], { testes: { acesso: 'erro' }, motivoTestes: 'teto' })))
    expect(teto.avisos.join(' ')).toContain('mais testes'); expect(teto.avisos.join(' ')).not.toContain('agora')
    const ok = buildTrocas(entrada(lidas([base()])))
    expect(ok.avisos.filter(a => a.includes('A/B Lab'))).toEqual([])
  })
})

describe('leitura de cada troca', () => {
  const troca = (dia: string, o: Partial<VersaoPropria> = {}) => versao({ dia, ...o })
  const run = (vs: VersaoPropria[], a: AlcanceCanal, over: Partial<EntradaTrocas> = {}, desde?: string) => buildTrocas(entrada(comAlcance([base(), ...vs], a, desde), over))
  const troca1 = (v: TrocasView) => (v.itens.find(i => i.tipo === 'troca') as { tipo: 'troca'; v: import('@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model').TrocaView }).v

  it('subiu: dois lados com número, faixas que não se cruzam, e a barra', () => {
    const dia = '2026-11-03'
    const a = alcance(addDays(dia, -20), HOJE, 1000, 0.02)
    for (const l of a.linhas) if (l.dia > dia) l.ctr = 0.09
    const t = troca1(run([troca(dia)], a))
    expect(t.chip).toBe('subiu')
    expect(t.antes?.forma).toBe('numero'); expect(t.depois?.forma).toBe('numero')
    expect(t.antes?.taxa).toBe('2,0%'); expect(t.depois?.taxa).toBe('9,0%')
    expect(t.frase).toBe('Subiu de 2,0% para 9,0%. As faixas não se cruzam.')
    expect(t.depois?.barra).not.toBeNull()
  })
  it('G-2: a barra usa um eixo comum de 0 ao maior limite da tela (taxas de 2 a 9% não ficam coladas à esquerda e a faixa tem largura visível)', () => {
    const dia = '2026-11-03'
    const a = alcance(addDays(dia, -20), HOJE, 1000, 0.02)
    for (const l of a.linhas) if (l.dia > dia) l.ctr = 0.09
    const t = troca1(run([troca(dia)], a))
    const lados = [t.antes!.barra!, t.depois!.barra!]
    expect(Math.max(...lados.map(b => b.hi))).toBeGreaterThan(0.8)
    expect(Math.max(...lados.map(b => b.hi))).toBeLessThanOrEqual(1)
    for (const b of lados) { expect(b.hi - b.lo).toBeGreaterThanOrEqual(0.04); expect(b.lo).toBeLessThanOrEqual(b.taxa); expect(b.taxa).toBeLessThanOrEqual(b.hi) }
    // a escala é a mesma nos dois lados: a taxa maior fica à direita da menor
    expect(lados[1]!.taxa).toBeGreaterThan(lados[0]!.taxa)
  })
  it('sem diferença firme: faixas que se cruzam', () => {
    const dia = '2026-11-03'
    const a = alcance(addDays(dia, -20), HOJE, 100, 0.05)
    const t = troca1(run([troca(dia)], a))
    expect(t.chip).toBe('sem-diferenca')
    expect(t.frase).toBe('De 5,0% para 5,0%, mas as faixas se cruzam: a diferença pode ser só acaso.')
  })
  it('troca de 45 dias com alcance lido de 54 dias: os dois lados com dias medidos, nunca "troca antiga"', () => {
    const dia = addDays(HOJE, -45)
    const desde = addDays(HOJE, -55) // o que `lerTrocas` pede: janela.de − (7 + 2)
    const t = troca1(run([troca(dia)], alcance(desde, HOJE), undefined, desde))
    expect(t.antes?.forma).toBe('numero'); expect(t.depois?.forma).toBe('numero')
    expect(todasAsFrases(buildTrocas(entrada(comAlcance([base(), troca(dia)], alcance(desde, HOJE), desde))))).not.toContain('troca antiga')
  })
  it('poucas impressões: 99 e 100 (fronteira lendo a constante); com 50 restaurado no afterEach o texto diz 50', () => {
    const dia = '2026-11-03'
    const mk = (n: number) => { const a = alcance(addDays(dia, -20), HOJE, n, 0.05); return run([troca(dia)], a) }
    // 1 dia de cada lado vale: imp por dia = n, mas há 7 dias de cada lado; usa um dia só
    const um = (n: number) => { const a = alcance(addDays(dia, -3), addDays(dia, -3), n, 0.05); const b = alcance(addDays(dia, 2), addDays(dia, 2), n, 0.05); return run([troca(dia)], { ...a, relatorios: [...a.relatorios, ...b.relatorios, { dia: HOJE, status: 'baixado', normalizado: true }], linhas: [...a.linhas, ...b.linhas] }) }
    expect(troca1(um(99)).chip).toBe('ainda-nao-da')
    expect(troca1(um(100)).chip).not.toBe('ainda-nao-da')
    PROPRIO_RULES.trocaMinImpressoesPorLado = 50
    expect(troca1(um(60)).chip).not.toBe('ainda-nao-da')
    expect(mk(1000)).toBeDefined()
  })
  it('zero medido nos dois lados: caixa vazada com 0, frase do zero, nunca "não medido"', () => {
    const dia = '2026-11-03'
    const t = troca1(run([troca(dia)], alcance(addDays(dia, -20), HOJE, 0)))
    expect(t.chip).toBe('ainda-nao-da')
    expect(t.antes?.forma).toBe('zero'); expect(t.depois?.forma).toBe('zero')
    expect(t.frase).toBe('Nos dias medidos o vídeo teve 0 impressões antes e 0 depois: o YouTube entregou os dias e ele não apareceu para ninguém.')
  })
  it('depois não medido: as três datas (troca + 1, + 3, + 9) enquanto hoje é anterior ao dia em que o primeiro chega', () => {
    const dia = addDays(HOJE, -1)
    const t = troca1(run([troca(dia)], alcance(addDays(dia, -20), addDays(HOJE, -2))))
    expect(t.chip).toBe('depois-nao-medido')
    expect(t.frase).toBe(`Ainda não dá para comparar. O primeiro dia depois da troca (${dm(addDays(dia, 1))}) só chega do YouTube em ${dm(addDays(dia, 3))}. Leitura completa em ${dm(addDays(dia, 9))}.`)
    const depois = troca1(run([troca(addDays(HOJE, -4))], alcance(addDays(HOJE, -30), addDays(HOJE, -4))))
    expect(depois.frase).not.toContain('só chega do YouTube em')
  })
  it('origem não sabida: sem lados, sem comparação, e a vista não cita CMS; cms soma no diagnóstico', () => {
    const v = run([troca('2026-11-03', { origem: 'nao_se_sabe' }), troca('2026-11-05', { origem: 'cms' })], alcance(addDays(HOJE, -40), HOJE))
    const ts = v.itens.filter(i => i.tipo === 'troca').map(i => (i as { v: import('@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model').TrocaView }).v)
    expect(ts.every(t => t.chip === 'origem-nao-sabida' && t.antes === null && t.depois === null)).toBe(true)
    expect(v.diagnostico.origemCms).toBe(1)
    expect(JSON.stringify(v)).not.toMatch(/CMS/)
  })
  it('vencedor e restauro: origem dita com o teste lido; sem acesso de edição o link vira "sem-acesso"', () => {
    const vs = [troca('2026-11-03', { origem: 'ab_lab', eventoAb: 'vencedor', abTestId: 't1' })]
    const l = comAlcance([base(), ...vs], alcance(addDays(HOJE, -40), HOJE), undefined, { testes: { acesso: 'ok', dado: { testes: [teste()], descartados: 0 } } })
    const edita = troca1(buildTrocas(entrada(l)))
    expect(edita.origem.teste).toEqual({ href: '/cms/youtube/ab-lab/t1' })
    expect(edita.origem.frase).toBe('aplicado em 03/11, no fim do teste de 20/10 a 02/11')
    expect(troca1(buildTrocas(entrada(l, { podeEditar: false }))).origem.teste).toBe('sem-acesso')
  })
  it('alcance em erro: lados com a forma erro e a vista não contém "não medido" nem "0 impressões"', () => {
    const v = buildTrocas(entrada(lidas([base(), troca('2026-11-03')], { alcance: { acesso: 'erro' } })))
    const t = troca1(v)
    expect(t.antes?.forma).toBe('erro'); expect(t.depois?.forma).toBe('erro')
    expect(JSON.stringify(v.itens)).not.toMatch(/não medido|0 impressões/)
  })
  it('troca no dia seguinte à publicação: "sem antes" com a causa da publicação, nunca forma erro', () => {
    const pub = '2026-10-20', dia = '2026-10-21'
    const t = troca1(run([troca(dia)], alcance(pub, HOJE), { publicadoEm: pub }, addDays(HOJE, -60)))
    expect(t.chip).toBe('sem-antes')
    expect(t.antes?.causa).toBe('o vídeo saiu logo antes da troca')
    expect(t.antes?.forma).not.toBe('erro')
  })
  it('relatórios só desde dd/mm depois do pedido: "as impressões por dia só existem desde"', () => {
    const dia = addDays(HOJE, -20)
    const t = troca1(run([troca(dia)], alcance(addDays(dia, -1), HOJE), {}, addDays(dia, -9 - 2)))
    expect(t.chip).toBe('sem-antes')
    expect(t.frase).toBe(`Sem antes para comparar. As impressões por dia só existem desde ${dmy(addDays(dia, -1))}.`)
  })
  it('troca vizinha fecha o lado: "sem dias para comparar" com a causa da troca (2)', () => {
    const t1 = '2026-11-03', t2 = '2026-11-04'
    const v = run([troca(t1), troca(t2)], alcance(addDays(HOJE, -40), HOJE))
    const ts = v.itens.filter(i => i.tipo === 'troca').map(i => (i as { v: import('@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model').TrocaView }).v)
    expect(ts[0]!.chip).toBe('sem-dias')
    expect(ts[0]!.depois?.causa).toBe('a troca (2) vem logo depois')
    expect(ts[1]!.antes?.causa).toBe('a troca (1) vem logo antes')
  })

  describe('período nulo: três ramos', () => {
    const dia = addDays(HOJE, -5)
    it('(1a) relatórios vazios e ultimoRelatorio nulo: "Ainda não há relatório de alcance deste canal."', () => {
      const v = run([troca(dia)], { canalId: C, relatorios: [], linhas: [], ultimoRelatorio: null, descartados: 0 })
      const t = troca1(v)
      expect(t.antes?.causa).toBe(SEM_RELATORIO); expect(t.depois?.causa).toBe(SEM_RELATORIO)
      expect(JSON.stringify(v)).not.toContain('troca antiga')
    })
    it('(1b) relatórios vazios e ultimoRelatorio há 20 dias: "parou em dd/mm", sem "Ainda não há relatório" e sem ainda', () => {
      const parou = addDays(HOJE, -20)
      const v = run([troca(dia)], { canalId: C, relatorios: [], linhas: [], ultimoRelatorio: parou, descartados: 0 })
      const t = troca1(v)
      expect(t.antes?.causa).toBe(`A coleta de relatórios deste canal parou em ${dm(parou)}.`)
      expect(t.depois?.causa).toBe(t.antes?.causa)
      expect(JSON.stringify(v.itens)).not.toMatch(/Ainda não há relatório|ainda/)
    })
    it('(1b) ultimoRelatorio do ano anterior ao de hojePt traz o ano', () => {
      const v = run([troca(dia)], { canalId: C, relatorios: [], linhas: [], ultimoRelatorio: '2025-12-30', descartados: 0 })
      expect(troca1(v).antes?.causa).toBe('A coleta de relatórios deste canal parou em 30/12/2025.')
    })
    it('(1c) vídeo publicado ontem, troca hoje, relatório mais novo de anteontem: Antes "sem antes" pela publicação e o Depois com as três datas', () => {
      const pub = addDays(HOJE, -1)
      const a = alcance(addDays(HOJE, -2), addDays(HOJE, -2))
      const t = troca1(run([troca(HOJE)], a, { publicadoEm: pub }, addDays(HOJE, -10)))
      expect(t.antes?.forma).toBe('sem-antes')
      expect(t.depois?.forma).toBe('nao-medido')
      expect(t.frase).toContain(`só chega do YouTube em ${dm(addDays(HOJE, 3))}`)
      expect(JSON.stringify(t)).not.toContain('relatório de alcance deste canal')
    })
  })

  describe('teto de 400 dias', () => {
    it('desdeDaTroca em hoje − 400: lados lidos; em hoje − 401: Antes "troca antiga", Depois com número, e sem "sem dd/mm"', () => {
      const J = PROPRIO_RULES.trocaJanelaDias
      const mk = (folga: number) => {
        // `desde` do leitor: max(hoje − 400, desdeDaTroca). Troca com janela.de = desde + J + 2 + folga.
        const desde = addDays(HOJE, -400)
        const jde = addDays(desde, J + 2 - folga)
        const dia = addDays(jde, 1)
        const v = versao({ dia, janela: { de: meio(jde), ate: meio(dia) } })
        return troca1(run([v], alcance(desde, HOJE), { publicadoEm: '2024-01-01' }, desde))
      }
      expect(mk(0).antes?.forma).toBe('numero')
      const antiga = mk(1)
      expect(antiga.antes?.causa).toBe('troca antiga'); expect(antiga.depois?.forma).toBe('numero')
      expect(JSON.stringify(antiga)).not.toMatch(/sem \d{2}\/\d{2}/)
    })
    it('publicação há 395 dias e troca há 393: causa da publicação, não "troca antiga"', () => {
      const pub = addDays(HOJE, -395), dia = addDays(HOJE, -393)
      const t = troca1(run([troca(dia)], alcance(addDays(HOJE, -400), HOJE), { publicadoEm: pub }, addDays(HOJE, -400)))
      expect(t.antes?.causa).not.toBe('troca antiga')
    })
  })
})

describe('portão L5 (17/10): consertos', () => {
  const troca = (dia: string, o: Partial<VersaoPropria> = {}) => versao({ dia, ...o })
  const run = (vs: VersaoPropria[], a: AlcanceCanal, over: Partial<EntradaTrocas> = {}, desde?: string) => buildTrocas(entrada(comAlcance([base(), ...vs], a, desde), over))
  const trocasDoItem = (v: TrocasView) => v.itens.flatMap(i => (i.tipo === 'troca' ? [i.v] : []))

  it('Phil I-1: troca vizinha no estado antes_fora_da_janela_lida: o depois da troca 1 para na troca 2, sem "só N impressões" nem contagem dupla', () => {
    const d1 = '2026-11-03', d2 = '2026-11-06' // publicado antes, relatórios só desde d1 + 1 (antes fora da janela lida)
    const a = alcance(addDays(d1, 1), HOJE, 1000, 0.05)
    const v = run([troca(d1), troca(d2)], a, { publicadoEm: addDays(d1, -2) }, addDays(d1, -9))
    const [t1, t2] = trocasDoItem(v)
    // o depois da troca 1 vai só até o dia antes da janela da troca 2: 1 dia (04/11), 1.000 impressões
    expect(t1!.depois!.rotulo).toBe('Depois: 1 dia (04/11), 1000 impressões')
    expect(t1!.depois!.causa ?? '').not.toMatch(/^só /)
    expect(t1!.depois!.forma).toBe('numero')
    // o depois da troca 2 tem os seus 7 dias e nenhum deles é o da troca 1
    expect(t2!.depois!.rotulo).toContain('7 dias'); expect(t2!.depois!.rotulo).not.toContain('04/11')
  })

  it('Phil I-2: registro atrasado e vídeo publicado depois da última conferência: não é "nunca registrado", o atraso e o dia da conferência aparecem', () => {
    const l = lidas([], {}, { atrasoDias: 9, conferidoAte: '2026-11-08' })
    l.versoes.videos[0]!.registro.title = { estado: 'sem_versao', conferidoAte: null }
    const v = buildTrocas(entrada(l, { publicadoEm: '2026-11-12' }))
    expect(v.estado).toBe('nao-registrado')
    expect(v.atraso).not.toBeNull()
    expect(v.frase).toContain('08/11'); expect(v.frase).toContain('saiu depois')
    expect(v.topo.aviso).toContain('08/11')
    // sem atraso e publicado antes da conferência: a frase de sempre e nenhum aviso
    const l2 = lidas([], {}, { atrasoDias: 0, conferidoAte: HOJE })
    l2.versoes.videos[0]!.registro.title = { estado: 'sem_versao', conferidoAte: null }
    const v2 = buildTrocas(entrada(l2, { publicadoEm: '2026-09-22' }))
    expect(v2.atraso).toBeNull(); expect(v2.topo.aviso).toBeNull(); expect(v2.frase).toContain('nenhuma versão')
  })

  it('Yannis I1: a causa do lado sem taxa vem do OUTRO lado, nunca "não tem dias" quando ele tem', () => {
    const n = (x: number) => String(x)
    // lado com impressões de sobra e sem taxa; o outro tem dias medidos mas poucas impressões
    expect(causaSemTaxa({ imp: 7000 }, { imp: 21, diasMedidos: 7 }, 100, n)).toBe('sem comparação: o outro lado tem só 21 impressões')
    expect(causaSemTaxa({ imp: 7000 }, { imp: 0, diasMedidos: 0 }, 100, n)).toBe('sem comparação: o outro lado não tem dia medido')
    expect(causaSemTaxa({ imp: 7000 }, { imp: 900, diasMedidos: 3 }, 100, n)).toBe('sem comparação possível')
    expect(causaSemTaxa({ imp: 7000 }, undefined, 100, n)).toBe('sem comparação possível')
    expect(causaSemTaxa({ imp: 21 }, { imp: 7000, diasMedidos: 7 }, 100, n)).toBe('só 21 impressões: sem faixa')
    expect(causaSemTaxa({ imp: 1 }, undefined, 100, n)).toBe('só 1 impressão: sem faixa')
  })
  it('Yannis I1 pela tela: dado impossível (cliques acima das impressões) no depois com antes de poucas impressões', () => {
    const dia = '2026-11-03'
    const a = alcance(addDays(dia, -3), addDays(dia, -3), 3, 0.05), b = alcance(addDays(dia, 2), addDays(dia, 2), 1000, 1.5)
    const v = run([troca(dia)], { ...a, relatorios: [...a.relatorios, ...b.relatorios, { dia: HOJE, status: 'baixado', normalizado: true }], linhas: [...a.linhas, ...b.linhas] })
    const [t] = trocasDoItem(v)
    expect(t!.depois!.causa ?? '').not.toContain('não tem dia')
  })

  it('Phil M-2: com retoqueContaComoTroca ligada, a lista das trocas e a vizinha seguem a mesma regra', () => {
    const retoque = { dhash: 'r', sha256: null, blobUrl: null, imagemExata: true, retoque: true }
    const vs = [base('thumb'), versao({ dia: '2026-11-03', campo: 'thumb', texto: null, thumb: retoque })]
    const lista = (video: VersaoPropria[]) => trocasQueContamDoTeste(canal(video).videos[0]!)
    expect(lista(vs)).toHaveLength(0)
    PROPRIO_RULES.retoqueContaComoTroca = true
    expect(lista(vs)).toHaveLength(1)
  })
  it('Phil M-4 / Yannis M4: o limiar de "quase se tocam" é regra viva', () => {
    expect(PROPRIO_RULES.trocaFaixasQuaseSeTocam).toBe(0.004)
    const dia = '2026-11-03'
    const a = alcance(addDays(dia, -20), HOJE, 1000, 0.02)
    for (const l of a.linhas) if (l.dia > dia) l.ctr = 0.09
    PROPRIO_RULES.trocaFaixasQuaseSeTocam = 0.5
    const [t] = trocasDoItem(run([troca(dia)], a))
    expect(t!.chip).toBe('subiu'); expect(t!.frase).toContain('quase se tocam')
  })
})

describe('topo, contagens, atraso, régua', () => {
  const trocas4 = ['2026-11-03', '2026-11-06', '2026-11-09', '2026-11-12'].map(d => versao({ dia: d }))
  it('3 trocas: por extenso; 4: contagem com o símbolo de cada chip e o link "Ver antes e depois"', () => {
    const a = alcance(addDays(HOJE, -40), HOJE)
    const tres = buildTrocas(entrada(comAlcance([base(), ...trocas4.slice(0, 3)], a)))
    expect(tres.topo.partes.map(p => p.t).join('')).toMatch(/^Trocas deste vídeo: título \(1\) em 03\/11, /)
    const quatro = buildTrocas(entrada(comAlcance([base(), ...trocas4], a)))
    expect(quatro.topo.partes[0]).toMatchObject({ t: '4 trocas', b: true })
    expect(quatro.topo.linkAntesDepois).toBe(true)
  })
  it('as contagens somam o número de trocas', () => {
    const v = buildTrocas(entrada(comAlcance([base(), ...trocas4], alcance(addDays(HOJE, -40), HOJE))))
    expect(v.contagens.reduce((s, c) => s + c.n, 0)).toBe(4)
  })
  it('atraso 1: sem aviso; atraso 2: com aviso e a linha "Trocas conferidas até"', () => {
    expect(buildTrocas(entrada(lidas([base()], {}, { atrasoDias: 1 }))).atraso).toBeNull()
    const v = buildTrocas(entrada(lidas([base()], {}, { atrasoDias: 2, conferidoAte: '2026-11-15' })))
    expect(v.atraso?.linhas.length).toBe(2); expect(v.topo.aviso).toContain('15/11')
    expect(v.metodo[v.metodo.length - 1]).toBe('Trocas conferidas até 15/11.')
  })
  it('marcas: uma por troca, no dia da troca, com a fala; título e thumbnail no mesmo dia: (1) é o título', () => {
    const t = versao({ dia: '2026-11-03', campo: 'thumb', thumb: { dhash: 'a', sha256: null, blobUrl: null, imagemExata: true, retoque: false }, texto: null })
    const ti = versao({ dia: '2026-11-03', campo: 'title' })
    const l = lidas([base(), base('thumb'), t, ti]); l.versoes.videos[0]!.registro.thumb = { estado: 'com_trocas', conferidoAte: HOJE }
    const v = buildTrocas(entrada(l))
    expect(v.marcas.map(m => [m.n, m.campo, m.fala])).toEqual([[1, 'title', 'troca (1) de título'], [2, 'thumb', 'troca (2) de thumbnail']])
    const th = (v.itens.find(i => i.tipo === 'troca' && i.v.campo === 'thumb') as { v: import('@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model').TrocaView }).v
    expect(th.para.notaImagem).toBe('imagem não guardada')
  })
  it('régua: de, ate, e aria que lista testes e trocas', () => {
    const v = buildTrocas(entrada(comAlcance([base(), versao({ dia: '2026-11-03' })], alcance(addDays(HOJE, -40), HOJE))))
    expect(v.regua).toMatchObject({ de: REG, ate: HOJE, rotuloAte: 'hoje, 17/11' })
    expect(v.regua?.aria).toContain('troca 1 de título em 03/11')
  })
})

describe('palavras e datas', () => {
  it('nenhuma das cinco palavras de causa aparece em nenhuma vista', () => {
    const vs = [
      buildTrocas(entrada(comAlcance([base(), versao({ dia: '2026-11-03' }), versao({ dia: '2026-11-10', origem: 'nao_se_sabe' })], alcance(addDays(HOJE, -40), HOJE)))),
      buildTrocas(entrada(lidas([base()]))), buildTrocas(entrada('negado')), buildTrocas(entrada('erro')),
    ]
    for (const v of vs) expect(JSON.stringify(v)).not.toMatch(/efeito|causou|por causa|fez subir|trocado pelo CMS/i)
  })
  it('nenhuma data aparece que não esteja na entrada (dd/mm da frase de uma troca típica)', () => {
    const v = buildTrocas(entrada(comAlcance([base(), versao({ dia: '2026-11-03' })], alcance(addDays(HOJE, -40), HOJE))))
    const datas = new Set<string>(); for (const m of JSON.stringify(v.itens).matchAll(/\d{2}\/\d{2}/g)) datas.add(m[0])
    const permitidas = new Set<string>(); for (let i = -40; i <= 0; i++) permitidas.add(dm(addDays(HOJE, i))); permitidas.add(dm(REG))
    for (const d of datas) expect(permitidas.has(d), d).toBe(true)
  })
})

describe('decisão 75: ausência da troca e frases fixas', () => {
  const troca = (dia: string, o: Partial<VersaoPropria> = {}) => versao({ dia, ...o })
  const run = (vs: VersaoPropria[], a: AlcanceCanal, over: Partial<EntradaTrocas> = {}, desde?: string) => buildTrocas(entrada(comAlcance([base(), ...vs], a, desde), over))
  const troca1 = (v: TrocasView) => (v.itens.find(i => i.tipo === 'troca') as { tipo: 'troca'; v: import('@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model').TrocaView }).v
  it('chip leitura-falhou → ausencia "falhou"; qualquer outro chip → null', () => {
    const t = troca1(buildTrocas(entrada(lidas([base(), troca('2026-11-03')], { alcance: { acesso: 'erro' } }))))
    expect(t.chip).toBe('leitura-falhou')
    expect(t.ausencia).toBe('falhou')
    const outra = troca1(run([troca('2026-10-21')], alcance('2026-10-20', HOJE), { publicadoEm: '2026-10-20' }, addDays(HOJE, -60)))
    expect(outra.chip).not.toBe('leitura-falhou')
    expect(outra.ausencia).toBeNull()
  })
  it('as constantes novas (o uso é da Task 6)', async () => {
    const m = await import('@/app/cms/(authed)/youtube/competitors/_proprio/trocas-model')
    expect(m.FRASE_TESTE_RESTRITO).toBe('Teste A/B restrito: o teste que gerou esta troca só abre para quem edita o site.')
    expect(m.FRASE_TROCA_FALHOU.startsWith('A leitura falhou:')).toBe(true)
  })
})
