// @vitest-environment node
// A4 Tarefa 6: o modelo do cabeçalho do canal próprio (faixa de 6, "Todos os números" de 11, linha de posição).
// Este sistema falha em VERDE: cada caso afirma o valor nulo E a frase, nunca um padrão; o dado ausente tem teste próprio
// (tabela vazia, leitura negada, leitura que falhou, nenhum dia lido, canal sem vídeo, canal parado, inscritos ocultos).
import { afterEach, describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  proprioWorld, mundoSemProprio, parado, semVideos, inscritosOcultos, semComentarios, DADOS, CHEIO, diarioCheio, alcanceCheio, alcanceSoVazios,
  alcanceNadaLido, alcanceComLinhas, primeiroProprio, type CenarioDados,
} from './proprio-fixture'
import {
  buildProprioHeader, FRASE_CTR, FRASE_ERRO, FRASE_NADA_LIDO, FRASE_NEGADO, FRASE_SEM_RELATORIO, fraseDoAlcance,
  type NumCell, type PosicaoNoNicho, type ProprioHeaderView,
} from '@/app/cms/(authed)/youtube/competitors/_proprio/header-model'
import { buildCanalHeader } from '@/app/cms/(authed)/youtube/competitors/_canal/header-model'
import { vpdText } from '@/app/cms/(authed)/youtube/competitors/_canal/numeros'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { numerosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_comparar/numeros-model'
import { dmDia, type ExtrasProprio } from '@/app/cms/(authed)/youtube/competitors/_proprio/extras'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { vpdDoCanal } from '@/lib/youtube/observatorio/proprio/vpd'
import type { DadosDoCanal } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados'
import type { AlcanceCanal } from '@/lib/youtube/observatorio/proprio/tipos'
import type { Dataset } from '@/lib/youtube/observatorio/types'

// Arquivo todo síncrono: uma macrotarefa por teste, para o executor do Vitest responder no CI (ver canais-a3-posicao.test.ts).
afterEach(() => new Promise<void>(r => setTimeout(r, 0)))

type World = ReturnType<typeof proprioWorld>
const BASE = proprioWorld() // a base do oráculo é lida uma vez por arquivo (a3-fixture guarda por preset)

// `muitosProprios` é obrigatório (T9, M6): o conjunto de cada mundo diz quantos canais próprios tem
const build = (w: World, posicao: PosicaoNoNicho | null = null): ProprioHeaderView =>
  buildProprioHeader(w.obs, w.canalId, w.dados, { hoje: w.hoje, dm: w.dm, posicao, muitosProprios: w.obs.ownChannels().length > 1 })!
const por = (cs: NumCell[], key: string): NumCell => {
  const c = cs.find(x => x.key === key)
  if (!c) throw new Error('célula inexistente: ' + key)
  return c
}
const todas = (h: ProprioHeaderView) => [...h.faixa, ...h.todos]
/** Sem valor: o valor é nulo e a frase está lá, exatamente. */
const naoMedida = (c: NumCell, frase: string) => { expect(c.value, c.key).toBeNull(); expect(c.missing, c.key).toBe(frase) }
/** Com valor: a frase é nula. */
const medida = (c: NumCell, valor: string) => { expect(c.value, c.key).toBe(valor); expect(c.missing, c.key).toBeNull() }
const comDados = (dados: Partial<DadosDoCanal>, mut?: Parameters<typeof proprioWorld>[0]['mut']) => proprioWorld({ dados, mut })
const ok = (a: AlcanceCanal): DadosDoCanal['alcance'] => ({ acesso: 'ok', dado: a })

const FAIXA = ['inscritos', 'videos', 'viewsSomadas', 'impressoes', 'diasComImpressao', 'diasDesdeUltimo']
// 13.3: ganha a taxa de clique do canal e o % assistido; a retenção vira "retenção (curva)"
const TODOS = ['cliques', 'taxaClique', 'videosComImpressao', 'medianaViews', 'maisVisto', 'engajamento90', 'engajamentoTodos', 'duracaoMediana', 'ritmo', 'vpdVideo', 'assistido', 'retencao', 'inscritos30']
const PRIVADAS_ALCANCE = ['impressoes', 'diasComImpressao', 'cliques', 'videosComImpressao']

describe('A4.6 cabeçalho próprio: forma', () => {
  it('faixa: seis células na ordem do spec 16.3, cada uma com rótulo e base', () => {
    const w = BASE
    const h = build(w)
    expect(h.faixa.map(c => c.key)).toEqual(FAIXA)
    for (const c of [...h.faixa, ...h.todos]) { expect(c.label, c.key).not.toBe(''); expect(c.base, c.key).not.toBe('') }
  })

  it('"Todos os números": treze células; nenhuma vazia: ou tem valor, ou tem a frase do motivo, nunca os dois nulos (nem os dois escritos)', () => {
    const h = build(BASE)
    expect(h.todos).toHaveLength(13)
    expect(h.todos.map(c => c.key)).toEqual(TODOS)
    const cenarios: CenarioDados[] = ['cheio', 'curto', 'vazio', 'parado', 'negado', 'erro']
    const mundos: Array<[string, Parameters<typeof proprioWorld>[0]['mut']]> = [['padrão', undefined], ['sem vídeos', semVideos], ['parado', parado], ['sem inscritos', inscritosOcultos], ['sem comentários', semComentarios]]
    for (const [nome, mut] of mundos) for (const cenario of cenarios) {
      const x = build(proprioWorld({ cenario, mut }))
      for (const c of todas(x)) {
        expect(c.value == null && c.missing == null, `${nome}/${cenario}/${c.key}: nulo dos dois lados`).toBe(false)
        expect(c.value != null && c.missing != null, `${nome}/${cenario}/${c.key}: escrito dos dois lados`).toBe(false)
        expect(c.base, `${nome}/${cenario}/${c.key}`).not.toBe('')
        expect(c.label, `${nome}/${cenario}/${c.key}`).not.toBe('')
        // nulo nunca vira zero: uma célula sem valor não escreve "0" como frase
        expect(c.missing ?? '', `${nome}/${cenario}/${c.key}`).not.toMatch(/^0\b/)
      }
    }
  })

  it('só o canal próprio tem cabeçalho: id de concorrente ou desconhecido devolve null', () => {
    const w = BASE
    const conc = w.obs.channels.find(c => !c.own)!.id
    for (const id of [conc, 'nao-existe']) expect(buildProprioHeader(w.obs, id, w.dados, { hoje: w.hoje, dm: w.dm, posicao: null }), id).toBeNull()
  })

  it('a identidade vem do canal: nome, @, endereço, avatar e iniciais; o selo de idioma só com mais de um canal próprio', () => {
    const w = BASE
    const ch = w.obs.channel(w.canalId)!
    const h = build(w)
    expect(h).toMatchObject({ id: ch.id, name: ch.name, handle: ch.handle, url: ch.url, ini: ch.ini })
    expect(h.avatar).toBe(ch.avatar ?? null)
    expect(h.lang).toEqual({ code: 'PT', title: 'Canal em português' }) // preset '2': dois canais próprios
    const um = proprioWorld({ preset: '1' })
    expect(build(um).lang).toBeNull()
  })
})

describe('A4.6 cabeçalho próprio: o que é público (do motor) mostra o mesmo que o cabeçalho do concorrente', () => {
  it('inscritos, inscritos em 30 dias e a linha de sincronização reaproveitam o cabeçalho do concorrente (mesmo texto, base e frase)', () => {
    const w = BASE
    const h = build(w)
    const c = buildCanalHeader(w.obs, w.canalId)!
    const { key: _a, ...i1 } = por(h.faixa, 'inscritos'), { key: _b, ...i2 } = c.faixa[0]!
    expect(i1).toMatchObject(i2)
    const { key: _c, ...g1 } = por(h.todos, 'inscritos30'), { key: _d, ...g2 } = c.faixa[1]!
    expect(g1).toMatchObject(g2)
    expect(h.sync.startsWith(c.sync.text.split(' · ')[0]!)).toBe(true)
  })

  it('vídeos, views somadas, mediana, vídeo mais visto, engajamento e duração batem com a conta feita à mão sobre os vídeos do canal', () => {
    const w = BASE
    const h = build(w)
    const vs = w.obs.videos.filter(v => v.ch === w.canalId)
    const F = w.obs.fmt
    medida(por(h.faixa, 'videos'), String(vs.length))
    medida(por(h.faixa, 'viewsSomadas'), F.num(vs.reduce((s, v) => s + (v.views ?? 0), 0)))
    const ord = vs.map(v => v.views!).sort((a, b) => a - b), m = ord.length >> 1
    const med = ord.length % 2 ? ord[m]! : (ord[m - 1]! + ord[m]!) / 2
    medida(por(h.todos, 'medianaViews'), F.num(med))
    const top = vs.reduce((a, v) => (v.views! > a.views! ? v : a))
    medida(por(h.todos, 'maisVisto'), F.num(top.views))
    expect(por(h.todos, 'maisVisto').base).toBe(top.title)
    const tx = vs.filter(v => v.views! > 0 && v.likes != null && v.comments != null).map(v => (v.likes! + v.comments!) / v.views!).sort((a, b) => a - b)
    const k = tx.length >> 1
    const mt = tx.length % 2 ? tx[k]! : (tx[k - 1]! + tx[k]!) / 2
    medida(por(h.todos, 'engajamentoTodos'), F.dec1(mt * 100) + '%')
    expect(por(h.todos, 'engajamentoTodos').n).toBeNull() // base grande: sem aviso de pouco dado
    const ultimo = Math.min(...vs.map(v => v.ageDays))
    medida(por(h.faixa, 'diasDesdeUltimo'), F.plural(ultimo, 'dia', 'dias'))
  })

  it('engajamento de todos os vídeos: comentário sem contagem fica fora da conta e é dito; sem nenhum vídeo medido a frase aparece, nunca 0%', () => {
    const w = proprioWorld({ mut: semComentarios })
    const c = por(build(w).todos, 'engajamentoTodos')
    naoMedida(c, 'nenhum vídeo com curtidas e comentários medidos')
    const nVideos = w.obs.videos.filter(v => v.ch === w.canalId).length
    expect(c.base).toContain(`${nVideos} sem curtidas ou comentários medidos ficam fora`)
    naoMedida(por(build(w).todos, 'engajamento90'), 'nenhum longo de 90 dias com curtidas e comentários medidos')
  })
})

describe('A4.6 cabeçalho próprio: o alcance (impressões, dias, cliques, vídeos)', () => {
  it('impressões: a soma do período, com o período escrito com as duas datas (nunca "28 dias")', () => {
    const w = BASE
    const c = por(build(w).faixa, 'impressoes')
    const de = addDays(w.hoje, -21), ate = addDays(w.hoje, -1) // o relatório mais novo é o de hoje-1 (por baixar); o mais antigo, hoje-21
    // 13.3: o rótulo é curto e o período vai na segunda linha da célula
    expect(c.label).toBe('impressões')
    expect(c.sub).toBe(`de ${w.dm(de)} a ${w.dm(ate)}`)
    expect(c.sub).not.toMatch(/28|dias/)
    medida(c, String(CHEIO.imp))
    expect(c.base).toContain(`de ${w.dm(de)} a ${w.dm(ate)}`)
    expect(c.base).toContain('2 dias sem dado ficam fora da soma') // hoje-2 e hoje-1 ainda por baixar
    expect(c.base).toContain('horário do Pacífico')
  })

  it('dias com impressão: "11 de 19" = dias com impressão sobre dias lidos (os dois por baixar não entram)', () => {
    const c = por(build(BASE).faixa, 'diasComImpressao')
    medida(c, `${CHEIO.diasCom} de ${CHEIO.diasLidos}`)
    expect(c.value).toBe('11 de 19')
    expect(c.base).toContain('11 trouxeram impressões e 8 vieram vazios')
  })

  it('sem relatório nenhum (tabela vazia): impressões, dias com impressão, cliques e vídeos com impressão dizem "ainda sem relatório de alcance deste canal"; value é null, nunca "0"', () => {
    const h = build(proprioWorld({ cenario: 'vazio' }))
    for (const k of PRIVADAS_ALCANCE) {
      const c = por([...h.faixa, ...h.todos], k)
      naoMedida(c, 'ainda sem relatório de alcance deste canal')
      expect(c.value).not.toBe('0')
    }
    expect(por(h.faixa, 'impressoes').label).toBe('impressões no período') // sem relatório não há duas datas a escrever
    expect(fraseDoAlcance('sem-relatorio')).toBe(FRASE_SEM_RELATORIO)
  })

  it('relatório sem nenhuma linha de alcance NEM relatório lido: tabela de linhas sem relatório não inventa período', () => {
    const w = proprioWorld()
    const so = proprioWorld({ dados: { alcance: ok({ canalId: w.canalId, relatorios: [], linhas: [{ ytId: w.ytIds[0]!, dia: addDays(w.hoje, -3), imp: 40, ctr: 0.1 }], ultimoRelatorio: null, descartados: 0 }) } })
    naoMedida(por(build(so).faixa, 'impressoes'), FRASE_SEM_RELATORIO)
  })

  it('todos os dias lidos vieram vazios: impressões é "0" medido, não a frase (e dias com impressão é "0 de N", cliques "0", vídeos "0 de N")', () => {
    const w = BASE
    const alcance = ok(alcanceSoVazios(w.canalId, w.hoje, 10))
    const h = build(comDados({ alcance }))
    medida(por(h.faixa, 'impressoes'), '0')
    medida(por(h.faixa, 'diasComImpressao'), '0 de 10')
    medida(por(h.todos, 'cliques'), '0')
    const total = w.obs.videos.filter(v => v.ch === w.canalId).length
    medida(por(h.todos, 'videosComImpressao'), `0 de ${total}`)
  })

  it('há relatório mas nenhum foi lido (por baixar, com erro, expirado): impressões e cliques dizem que nenhum dia foi lido, nunca "0"', () => {
    const w = BASE
    const h = build(comDados({ alcance: ok(alcanceNadaLido(w.canalId, w.hoje)) }))
    for (const k of PRIVADAS_ALCANCE) naoMedida(por([...h.faixa, ...h.todos], k), FRASE_NADA_LIDO)
    expect(FRASE_NADA_LIDO).toBe('nenhum dia do período foi medido ainda')
    // o período existe e é escrito, mesmo sem número
    expect(por(h.faixa, 'impressoes').label).toBe('impressões no período')   // 13.3: sem número não há segunda linha; o período mora na base
  })

  it('sem permissão de edição: as células privadas dizem "só quem edita o site vê este número"; as públicas não mudam', () => {
    const cheio = build(BASE)
    const neg = build(proprioWorld({ cenario: 'negado' }))
    for (const k of PRIVADAS_ALCANCE) naoMedida(por([...neg.faixa, ...neg.todos], k), 'só quem edita o site vê este número')
    expect(FRASE_NEGADO).toBe('só quem edita o site vê este número')
    // views/dia por vídeo é privada também; a frase é a das outras telas (lista e comparação)
    naoMedida(por(neg.todos, 'vpdVideo'), 'só quem edita o site vê as views por dia do seu canal')
    const privadas = new Set([...PRIVADAS_ALCANCE, 'vpdVideo', 'taxaClique', 'assistido'])   // 13.3: a taxa e o % assistido também são privados
    for (const k of [...FAIXA, ...TODOS]) {
      if (privadas.has(k)) continue
      expect(por([...neg.faixa, ...neg.todos], k), k).toEqual(por([...cheio.faixa, ...cheio.todos], k))
    }
    // o rótulo da impressão não escreve datas que ninguém leu
    expect(por(neg.faixa, 'impressoes').label).toBe('impressões no período')
    expect(neg.sync).toBe(cheio.sync)
  })

  it('leitura que falhou: cada célula privada diz que a leitura falhou agora, sem número', () => {
    const h = build(proprioWorld({ cenario: 'erro' }))
    for (const k of PRIVADAS_ALCANCE) naoMedida(por([...h.faixa, ...h.todos], k), 'a leitura do alcance falhou agora; recarregue a página')
    expect(FRASE_ERRO).toBe('a leitura do alcance falhou agora; recarregue a página')
    naoMedida(por(h.todos, 'vpdVideo'), 'a leitura das views por dia falhou agora; recarregue a página')
  })

  it('a frase de cada estado do alcance é uma só e vem de um switch exaustivo: os quatro estados, uma frase para cada um dos três sem número', () => {
    expect(fraseDoAlcance('ok')).toBeNull()
    const frases = (['negado', 'erro', 'sem-relatorio'] as const).map(e => fraseDoAlcance(e))
    expect(new Set(frases).size).toBe(3)
    for (const f of frases) expect(f).toEqual(expect.any(String))
  })

  it('cliques estimados: arredondado só no total; com CTR ausente em algum dia vira "não medido" com o motivo', () => {
    const w = BASE
    const d = (n: number) => addDays(w.hoje, -n)
    const yt = w.ytIds[0]!
    const rel = (n: number) => ({ dia: d(n), status: 'baixado' as const, normalizado: true })
    const cl = (linhas: Array<[number, number, number | null]>, dias: number[]) => por(build(comDados({
      alcance: ok({ canalId: w.canalId, relatorios: dias.map(rel), linhas: linhas.map(([n, imp, ctr]) => ({ ytId: yt, dia: d(n), imp, ctr })), ultimoRelatorio: d(Math.min(...dias)), descartados: 0 }),
    })).todos, 'cliques')
    // 26 × 0,1 = 2,6 → "3"
    medida(cl([[3, 26, 0.1]], [3]), '3')
    // duas parcelas de 1,4: somar sem arredondar dá 2,8 → "3"; arredondar por dia daria 1 + 1 = "2"
    medida(cl([[3, 14, 0.1], [4, 14, 0.1]], [3, 4]), '3')
    // 0,3 clique estimado não é "0 cliques": "menos de 1"
    medida(cl([[3, 3, 0.1]], [3]), 'menos de 1')
    // CTR nulo em um dia com impressão: o total não existe, mesmo havendo outro dia com CTR
    const nulo = cl([[3, 20, 0.1], [4, 10, null]], [3, 4])
    naoMedida(nulo, FRASE_CTR)
    expect(FRASE_CTR).toContain('não medido')
    expect(nulo.base).toContain('sem a taxa de clique')
    // dias medidos sem impressão: zero medido
    medida(cl([], [3, 4]), '0')
  })

  it('série cheia: cliques = Σ impressões × CTR sem arredondar por linha, e vídeos com impressão contam só quem apareceu', () => {
    const h = build(BASE)
    medida(por(h.todos, 'cliques'), String(Math.round(CHEIO.cliques)))
    const total = BASE.obs.videos.filter(v => v.ch === BASE.canalId).length
    medida(por(h.todos, 'videosComImpressao'), `${CHEIO.videosCom} de ${total}`)
    expect(por(h.todos, 'cliques').base).toContain('o total pode diferir da soma das partes escritas')
  })

  it('série curta: dois dias lidos escrevem o número que há (nada de "poucos dados" no lugar de um número medido)', () => {
    const h = build(proprioWorld({ cenario: 'curto' }))
    medida(por(h.faixa, 'impressoes'), '9')
    medida(por(h.faixa, 'diasComImpressao'), '1 de 2')
    medida(por(h.todos, 'cliques'), '1') // 9 × 0,1 = 0,9 → 1
  })
})

describe('A4.6 cabeçalho próprio: views por dia, retenção e inscritos em 30 dias', () => {
  it('views/dia por vídeo: número do diário com a base de 28 dias, escrito por vpdText como a lista e a comparação', () => {
    const w = BASE
    const c = por(build(w).todos, 'vpdVideo')
    // a série cheia dá 2, 4, 6… por vídeo; a mediana de N vídeos está no meio da fila
    const valores = w.ytIds.map((_, j) => (j + 1) * 2).sort((a, b) => a - b)
    const meio = valores.length >> 1
    const mediana = valores.length % 2 ? valores[meio]! : (valores[meio - 1]! + valores[meio]!) / 2
    medida(c, vpdText(mediana, w.obs.fmt.num)!)
    const ultimo = addDays(w.hoje, -2)
    expect(c.base).toBe(`média dos últimos 28 dias do YouTube com medida (de ${w.dm(addDays(ultimo, -27))} a ${w.dm(ultimo)}), mediana de ${w.ytIds.length} longos`)
    expect(c.n).toBeNull() // 29 vídeos: base grande
    expect(c.label).toBe('views/dia por vídeo')
  })

  it('o mesmo canal mostra o mesmo número de views por dia no cabeçalho, na lista de Canais e na comparação', () => {
    for (const valorDia of [0, 0.01, 0.4, 2.4, 9.96, 30, 999.4, 15800]) {
      const w = comDados({ diario: { acesso: 'ok', dado: { ...diarioCheio(BASE.canalId, BASE.ytIds, BASE.hoje), linhas: BASE.ytIds.flatMap(yt => Array.from({ length: 28 }, (_, n) => ({ ytId: yt, dia: addDays(BASE.hoje, -2 - n), views: valorDia }))) } } })
      const cab = por(build(w).todos, 'vpdVideo').value
      const vpd = vpdDoCanal(w.dados.diario, w.ytIds, w.hoje)
      const extras: ExtrasProprio = { vpd: new Map([[w.canalId, vpd]]), dm: dmDia }
      const lista = buildCanaisView(w.obs, { niche: 'todos', limit: 75, sort: 'vpd', scale: 'abs' }, extras)
      const linha = [...lista.list.ranked, ...lista.list.unranked].find(r => r.id === w.canalId)!
      const celula = linha.cells.vpd
      if (celula.kind !== 'ok') throw new Error('a lista deveria ter o número: ' + valorDia)
      const comp = numerosDoCanal(w.obs, w.canalId, undefined, extras).vpd.texto
      const sem = (s: string | null) => s?.replace(/ /g, ' ')
      expect(cab, String(valorDia)).toBe(vpdText(valorDia, w.obs.fmt.num))
      expect(sem(celula.big), String(valorDia)).toBe(sem(cab))
      expect(sem(comp ?? null), String(valorDia)).toBe(sem(cab))
    }
  })

  it('views/dia por vídeo: cada um dos seis motivos de ausência tem a sua frase e o valor é null', () => {
    const w = BASE
    const hoje = w.hoje
    const casos: Array<[string, DadosDoCanal['diario'], string]> = [
      ['sem-acesso', { acesso: 'negado' }, 'só quem edita o site vê as views por dia do seu canal'],
      ['leitura-falhou', { acesso: 'erro' }, 'a leitura das views por dia falhou agora; recarregue a página'],
      ['sem-diario', DADOS.vazio(w.canalId, w.ytIds, hoje).diario, 'ainda não há coleta diária deste canal'],
      ['diario-parado', DADOS.parado(w.canalId, w.ytIds, hoje).diario, `a coleta diária deste canal parou em ${w.dm(addDays(hoje, -20))}`],
      ['poucos-dias', DADOS.curto(w.canalId, w.ytIds, hoje).diario, 'menos de 7 dias medidos nos últimos 28'],
    ]
    for (const [nome, diario, frase] of casos) {
      const c = por(build(comDados({ diario })).todos, 'vpdVideo')
      naoMedida(c, frase)
      expect(c.value, nome).not.toBe('0')
    }
    // sem-longos: o diário tem dia recente, mas o canal não tem nenhum longo acompanhado (só Shorts, ou nenhum vídeo)
    const sv = proprioWorld({ mut: semVideos })
    const diarioDeOutroTempo: DadosDoCanal['diario'] = { acesso: 'ok', dado: diarioCheio(sv.canalId, ['yt-que-nao-existe-mais'], sv.hoje) }
    const semLongos = build(proprioWorld({ mut: semVideos, dados: { diario: diarioDeOutroTempo } }))
    naoMedida(por(semLongos.todos, 'vpdVideo'), 'nenhum vídeo longo acompanhado')
    expect(new Set([...casos.map(c => c[2]), 'nenhum vídeo longo acompanhado']).size).toBe(6)
  })

  it('zero medido (canal parado há pouco, linhas com views 0): views/dia é "0", não a frase', () => {
    const w = BASE
    const diario: DadosDoCanal['diario'] = { acesso: 'ok', dado: { ...diarioCheio(w.canalId, w.ytIds, w.hoje), linhas: w.ytIds.flatMap(yt => Array.from({ length: 28 }, (_, n) => ({ ytId: yt, dia: addDays(w.hoje, -2 - n), views: 0 }))) } }
    medida(por(build(comDados({ diario })).todos, 'vpdVideo'), '0')
  })

  it('retenção (curva): "a curva ainda não é coletada" (13.3); inscritos em 30 dias: "sem contagem de 30 dias atrás" (D12 b, D17)', () => {
    const h = build(BASE)
    const r = por(h.todos, 'retencao')
    naoMedida(r, 'a curva ainda não é coletada')
    expect(r.base).toContain('chega com a coleta de retenção')
    naoMedida(por(h.todos, 'inscritos30'), 'sem contagem de 30 dias atrás')
    expect(por(h.todos, 'inscritos30').base).toContain('precisa de duas contagens de inscritos com 30 dias entre elas')
  })
})

describe('A4.6 cabeçalho próprio: canal parado, canal novo e inscritos ocultos', () => {
  it('canal parado: ritmo "parado: nenhum em 13 semanas" (zero medido, valor e não "não medido") e dias desde o último vídeo com o número medido', () => {
    const w = proprioWorld({ mut: parado })
    const h = build(w)
    medida(por(h.todos, 'ritmo'), 'parado: nenhum em 13 semanas')
    const idade = Math.min(...w.obs.videos.filter(v => v.ch === w.canalId).map(v => v.ageDays))
    expect(idade).toBeGreaterThanOrEqual(91)
    medida(por(h.faixa, 'diasDesdeUltimo'), `${idade} dias`)
    // o canal parado continua com todas as outras células
    expect(por(h.faixa, 'videos').value).not.toBe('0')
    // fora do parado o ritmo é um número, não a frase
    expect(por(build(BASE).todos, 'ritmo').value).toMatch(/^\d+,\d \+ \d+,\d$/)
  })

  it('canal novo, sem nenhum vídeo: "0" vídeos é zero medido; o resto diz que não há vídeo, sem 0 inventado', () => {
    const w = proprioWorld({ mut: semVideos, cenario: 'vazio' })
    const h = build(w)
    medida(por(h.faixa, 'videos'), '0')
    expect(por(h.faixa, 'videos').base).toBe('nenhum vídeo guardado para este canal')
    naoMedida(por(h.faixa, 'viewsSomadas'), 'nenhum vídeo guardado')
    naoMedida(por(h.faixa, 'diasDesdeUltimo'), 'nenhum vídeo guardado')
    naoMedida(por(h.todos, 'medianaViews'), 'nenhum vídeo guardado')
    naoMedida(por(h.todos, 'maisVisto'), 'nenhum vídeo guardado')
    naoMedida(por(h.todos, 'engajamentoTodos'), 'nenhum vídeo guardado')
    naoMedida(por(h.todos, 'engajamento90'), 'nenhum longo em 90 dias')
    naoMedida(por(h.todos, 'duracaoMediana'), 'sem duração nos longos')
    naoMedida(por(h.todos, 'vpdVideo'), 'ainda não há coleta diária deste canal')
    medida(por(h.todos, 'ritmo'), 'parado: nenhum em 13 semanas')
    expect(h.sync).toContain(' · nenhum vídeo guardado')
  })

  it('inscritos ocultos (null): "não medido" com o motivo, nunca 0', () => {
    const w = proprioWorld({ mut: inscritosOcultos })
    const h = build(w)
    const c = por(h.faixa, 'inscritos')
    naoMedida(c, 'inscritos ocultos pelo canal')
    expect(c.base).toBe('o canal esconde a contagem de inscritos no YouTube')
    // com inscritos ocultos a linha de posição diz o motivo em vez de "0"
    const linha = build(w, { conjunto: { tipo: 'geral' }, inscritos: null, medianaViews: { pos: 2, de: 5, empate: false }, longos90: { pos: 1, de: 5, empate: false }, vpdPorMil: null }).posicaoLinha!
    expect(linha).toContain('sem posição em inscritos (ocultos pelo canal)')
    expect(linha).toContain('Views/dia por mil inscritos: inscritos ocultos pelo canal.')
  })
})

describe('A4.6 cabeçalho próprio: sincronização', () => {
  it('a linha de sincronização diz quando e quantos vídeos, com o texto do cabeçalho do concorrente', () => {
    const w = BASE
    const total = w.obs.videos.filter(v => v.ch === w.canalId).length
    const h = build(w)
    expect(h.sync.startsWith('Sincronizado ')).toBe(true)
    expect(h.sync.endsWith(` · ${total} vídeos`)).toBe(true)
  })
})

describe('A4.6 cabeçalho próprio: linha de posição', () => {
  const NICHO = { tipo: 'nicho', niche: 'viagem', label: 'Viagem' } as const
  it('diz o conjunto ("Entre 14 canais de Viagem: …"), com "(nenhum)" para zero medido; sem posição calculada a linha é null', () => {
    const w = proprioWorld({ mut: parado }) // nenhum longo em 90 dias
    const p: PosicaoNoNicho = {
      conjunto: NICHO, inscritos: { pos: 14, de: 14, empate: false }, medianaViews: { pos: 14, de: 14, empate: false },
      longos90: { pos: 13, de: 14, empate: false }, vpdPorMil: null,
    }
    const h = build(w, p)
    expect(h.posicaoLinha).toBe('Entre 14 canais de Viagem: 14º em inscritos, 14º em mediana de views, 13º em longos em 90 dias (nenhum). Views/dia por mil inscritos: ainda não medido.')
    expect(build(w, null).posicaoLinha).toBeNull()
    // com longos em 90 dias não há "(nenhum)"
    const novo = build(BASE, p).posicaoLinha!
    expect(novo).toContain('13º em longos em 90 dias.')
    expect(novo).not.toContain('(nenhum)')
  })

  it('o conjunto geral escreve "no geral"; empate é dito; um conjunto menor para um número diz o "de N" dele; views/dia por mil com posição escreve o valor', () => {
    const w = BASE
    const subs = w.obs.channel(w.canalId)!.subs!
    const p: PosicaoNoNicho = {
      conjunto: { tipo: 'geral' }, inscritos: { pos: 3, de: 75, empate: true }, medianaViews: { pos: 9, de: 75, empate: false },
      longos90: { pos: 4, de: 70, empate: false }, vpdPorMil: { pos: 2, de: 60, empate: false },
    }
    const linha = build(w, p).posicaoLinha!
    // a mediana dos 29 longos do canal na série cheia é 30 views/dia
    const porMil = vpdText(30 / (subs / 1000), w.obs.fmt.num)
    expect(linha).toBe(`Entre 75 canais no geral: 3º em inscritos (empate), 9º em mediana de views, 4º de 70 em longos em 90 dias. Views/dia por mil inscritos: 2º de 60, com ${porMil}.`)
  })

  it('views/dia por mil sem posição diz o motivo da ausência das views por dia, não "ainda não medido"', () => {
    const p: PosicaoNoNicho = { conjunto: NICHO, inscritos: { pos: 1, de: 3, empate: false }, medianaViews: { pos: 1, de: 3, empate: false }, longos90: { pos: 1, de: 3, empate: false }, vpdPorMil: null }
    const neg = build(proprioWorld({ cenario: 'negado' }), p).posicaoLinha!
    expect(neg.endsWith('Views/dia por mil inscritos: só quem edita o site vê as views por dia do seu canal.')).toBe(true)
    const vazio = build(proprioWorld({ cenario: 'vazio' }), p).posicaoLinha!
    expect(vazio.endsWith('Views/dia por mil inscritos: ainda não há coleta diária deste canal.')).toBe(true)
  })
})

describe('A4.6 cabeçalho próprio: texto e dependências', () => {
  const INTERNAS = /L2|L3|lote|day_pt|dataset|pack|pacote|motor\b|Reporting|Analytics API|escala √|diário/
  it('nenhum texto do cabeçalho traz palavra interna', () => {
    const p: PosicaoNoNicho = { conjunto: NICHO_GERAL, inscritos: { pos: 1, de: 3, empate: true }, medianaViews: null, longos90: { pos: 2, de: 3, empate: false }, vpdPorMil: { pos: 1, de: 3, empate: false } }
    const cenarios: CenarioDados[] = ['cheio', 'curto', 'vazio', 'parado', 'negado', 'erro']
    for (const cenario of cenarios) for (const mut of [undefined, semVideos, parado, inscritosOcultos]) {
      const h = build(proprioWorld({ cenario, mut }), p)
      const textos = [...todas(h).flatMap(c => [c.label, c.value, c.missing, c.n, c.base]), h.sync, h.posicaoLinha].filter((x): x is string => x != null)
      expect(textos.length).toBeGreaterThan(40)
      for (const t of textos) expect(t, `${cenario}: ${t}`).not.toMatch(INTERNAS)
    }
  })

  it('o modelo não lê banco: não importa os leitores, a prova de edição nem o módulo de servidor (só o tipo)', () => {
    const src = readFileSync(join(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_proprio/header-model.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    expect(violacoesDeImport(src)).toEqual([])
    // controles: o detector pega cada uma das violações
    expect(violacoesDeImport(`import { lerAlcance } from '@/lib/youtube/observatorio/proprio/ler'`)).toHaveLength(1)
    expect(violacoesDeImport(`import { provarEdicao } from '@/lib/youtube/observatorio/proprio/edicao'`)).toHaveLength(1)
    expect(violacoesDeImport(`import { podeVerPrivado } from './dados'`)).toHaveLength(1)
    expect(violacoesDeImport(`import 'server-only'`)).toHaveLength(1)
    expect(violacoesDeImport(`import type { DadosDoCanal } from './dados'`)).toEqual([])
  })

  it('o mundo sem canal próprio existe e o motor devolve null para qualquer id', () => {
    const obs = mundoSemProprio()
    expect(obs.ownChannels()).toHaveLength(0)
    expect(buildProprioHeader(obs, 'tnfigueiredo', { alcance: { acesso: 'negado' }, diario: { acesso: 'negado' } }, { hoje: BASE.hoje, dm: dmDia, posicao: null })).toBeNull()
  })

  it('o dado de entrada não é alterado e a montagem é determinística', () => {
    const w = BASE
    const antes = JSON.stringify(w.dados)
    const a = build(w), b = build(w)
    expect(b).toEqual(a)
    expect(JSON.stringify(w.dados)).toBe(antes)
    // sanidade da fixture: a série cheia é a que os números do teste esperam
    expect(alcanceCheio(w.canalId, w.ytIds, w.hoje).linhas).toHaveLength(CHEIO.diasCom * 2)
  })
})

const NICHO_GERAL = { tipo: 'geral' } as const

/** As quatro dependências que um modelo puro não pode ter: leitor, prova de edição, módulo de servidor e import de valor de `./dados`. */
/* ---------------------------------------------------------------- a conta feita à mão (I1 da revisão da Tarefa 6) */
// Cada caso abaixo nasceu de um mutante que sobrevivia: o teste afirma o texto EXATO e o recalcula sem usar o código do modelo.

const DIA_MS = 86_400_000
const meio = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const o = [...xs].sort((a, b) => a - b), k = o.length >> 1
  return o.length % 2 ? o[k]! : (o[k - 1]! + o[k]!) / 2
}
/** 3,69… → "3,7%" (uma casa, vírgula): escrito aqui, não importado do formatador do produto. */
const pct1 = (x: number) => (Math.round(x * 1000) / 10).toFixed(1).replace('.', ',') + '%'
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.round(sec % 60)).padStart(2, '0')}`
const proprios = (w: World) => w.obs.videos.filter(v => v.ch === w.canalId)
const pw = (n: number) => (Math.round(n / 13 * 10) / 10).toFixed(1).replace('.', ',')
/** Os que o ritmo conta: publicados nas últimas 13 semanas (91 dias) do relógio do oráculo. */
const naJanela = (w: World, fmt: 'long' | 'short') => proprios(w).filter(v => v.fmt === fmt && v.pub > w.obs.NOW - 91 * DIA_MS).length
const soOsPrimeirosLongos = (n: number) => (ds: Dataset) => {
  const id = primeiroProprio(ds).id
  const fica = ds.videos.filter(v => v.ch === id && v.fmt === 'long').slice(0, n)
  ds.videos = ds.videos.filter(v => v.ch !== id).concat(fica)
}
/** Empurra para 100 dias atrás todos os vídeos do formato; o outro formato fica como está. */
const envelhece = (fmt: 'long' | 'short') => (ds: Dataset) => {
  const id = primeiroProprio(ds).id
  for (const v of ds.videos) if (v.ch === id && v.fmt === fmt) { v.pub -= 100 * DIA_MS; v.ageDays += 100 }
}

describe('A4.6 cabeçalho próprio: os números públicos batem com a conta à mão (texto exato)', () => {
  it('engajamento em 90 dias: mediana de (curtidas + comentários) ÷ views só dos LONGOS de até 90 dias; os Shorts dariam outro número', () => {
    const w = BASE
    const vs = proprios(w)
    const taxas = (fmt: 'long' | 'short') => vs.filter(v => v.tracked && v.fmt === fmt && v.ageDays <= 90 && v.views != null && v.views > 0 && v.likes != null && v.comments != null)
      .map(v => (v.likes! + v.comments!) / v.views!)
    const longos = taxas('long'), shorts = taxas('short')
    // a fixture discrimina: lendo os Shorts o texto seria outro
    expect(pct1(meio(shorts)!)).toBe('3,2%')
    expect(pct1(meio(longos)!)).toBe('3,7%')
    const c = por(build(w).todos, 'engajamento90')
    medida(c, '3,7%')
    expect(c.value).toBe(pct1(meio(longos)!))
    expect(c.base).toBe(`(curtidas + comentários) ÷ views, mediana em ${longos.length} longos de até 90 dias`)
    expect(longos).toHaveLength(8)
    expect(c.n).toBeNull() // 8 longos: base suficiente
  })

  it('engajamento de todos os vídeos, texto exato', () => {
    const w = BASE
    const taxas = proprios(w).filter(v => v.views! > 0 && v.likes != null && v.comments != null).map(v => (v.likes! + v.comments!) / v.views!)
    const c = por(build(w).todos, 'engajamentoTodos')
    medida(c, '3,5%')
    expect(c.value).toBe(pct1(meio(taxas)!))
  })

  it('vídeos novos com 0 views, 0 curtidas e 0 comentários: a conta os deixa de fora (0 ÷ 0 não é taxa), nunca "NaN%"', () => {
    // 40 dos 58 vídeos recém-publicados e zerados: sem a guarda de views > 0 os NaN dominariam a mediana
    const zerados = (ds: Dataset) => {
      const id = primeiroProprio(ds).id
      for (const v of ds.videos.filter(x => x.ch === id).sort((a, b) => a.ageDays - b.ageDays).slice(0, 40)) { v.views = 0; v.likes = 0; v.comments = 0 }
    }
    const w = proprioWorld({ mut: zerados })
    expect(proprios(w).filter(v => v.views === 0)).toHaveLength(40) // sanidade: a mutação pegou
    const h = build(w)
    const c90 = por(h.todos, 'engajamento90'), cT = por(h.todos, 'engajamentoTodos')
    const validos = (so90: boolean) => proprios(w).filter(v => (!so90 || (v.tracked && v.fmt === 'long' && v.ageDays <= 90)) && v.views! > 0 && v.likes != null && v.comments != null)
    const conta = (so90: boolean) => meio(validos(so90).map(v => (v.likes! + v.comments!) / v.views!))!
    expect(validos(false)).toHaveLength(18)
    expect(cT.value).toMatch(/^\d+,\d%$/)
    medida(cT, pct1(conta(false)))
    expect(cT.base).toContain('mediana em 18 vídeos')
    // todos os longos de 90 dias foram zerados: não sobra taxa, a célula diz a frase em vez de um número
    expect(validos(true)).toHaveLength(0)
    naoMedida(c90, 'nenhum longo de 90 dias com curtidas e comentários medidos')
    // views 0 é contagem medida: entra na soma
    expect(por(h.faixa, 'viewsSomadas').value).toBe(w.obs.fmt.num(proprios(w).reduce((a, v) => a + (v.views ?? 0), 0)))
  })

  it('duração mediana dos longos: mm:ss exato da mediana de `dur` (um valor dobrado ou de Shorts seria outro)', () => {
    const w = BASE
    const durs = proprios(w).filter(v => v.tracked && v.fmt === 'long').map(v => v.dur!)
    const c = por(build(w).todos, 'duracaoMediana')
    medida(c, '20:38')
    expect(c.value).toBe(mmss(meio(durs)!))
    expect(c.base).toBe('mediana em 29 longos acompanhados')
    // os Shorts dariam 00:39: a conta não os mistura
    expect(mmss(meio(proprios(w).filter(v => v.fmt === 'short').map(v => v.dur!))!)).toBe('00:39')
  })

  it('ritmo: "longos + Shorts" nessa ordem, cada um pela sua contagem de 13 semanas (os dois números são diferentes)', () => {
    const w = BASE
    const l = naJanela(w, 'long'), sh = naJanela(w, 'short')
    expect([l, sh]).toEqual([8, 7])
    const c = por(build(w).todos, 'ritmo')
    medida(c, '0,6 + 0,5')
    expect(c.value).toBe(`${pw(l)} + ${pw(sh)}`)
    expect(c.base).toBe('longos + Shorts por semana, média de 13 semanas (8 longos, 7 Shorts)')
  })

  it('canal que só posta Shorts (nenhum longo em 13 semanas) NÃO está parado: "0,0 + 0,5"', () => {
    const w = proprioWorld({ mut: envelhece('long') })
    expect(naJanela(w, 'long')).toBe(0)
    const c = por(build(w).todos, 'ritmo')
    medida(c, `0,0 + ${pw(naJanela(w, 'short'))}`)
    expect(c.value).toBe('0,0 + 0,5')
    expect(c.value).not.toContain('parado')
  })

  it('canal que só posta longos (nenhum Short em 13 semanas) NÃO está parado: "0,6 + 0,0"', () => {
    const w = proprioWorld({ mut: envelhece('short') })
    expect(naJanela(w, 'short')).toBe(0)
    const c = por(build(w).todos, 'ritmo')
    medida(c, '0,6 + 0,0')
    expect(c.value).not.toContain('parado')
  })

  it('base fraca: com menos de 3 vídeos o aviso "n = k" aparece em mediana de views e em views/dia; com 3 some', () => {
    for (const [n, aviso] of [[1, 'n = 1'], [2, 'n = 2'], [3, null]] as const) {
      const w = proprioWorld({ mut: soOsPrimeirosLongos(n) })
      expect(proprios(w)).toHaveLength(n)
      const h = build(w)
      expect(por(h.todos, 'medianaViews').n, `medianaViews com ${n}`).toBe(aviso)
      expect(por(h.todos, 'vpdVideo').n, `vpdVideo com ${n}`).toBe(aviso)
      expect(por(h.todos, 'vpdVideo').value, `vpdVideo com ${n}`).not.toBeNull() // o aviso acompanha um número, não substitui
    }
  })
})

describe('A4.6 cabeçalho próprio: vídeos com impressão, cliques e views/dia na janela certa', () => {
  const d = (n: number) => addDays(BASE.hoje, -n)
  const linha = (ytId: string, n: number, imp: number, ctr: number | null) => ({ ytId, dia: d(n), imp, ctr })
  // um Short publicado antes do dia da linha (5 dias atrás): o dia anterior à publicação não existe, então um Short mais novo não teria essa linha
  const SHORT = proprios(BASE).find(v => v.fmt === 'short' && v.ageDays > 5)!.ytId
  const [A] = BASE.ytIds as [string]
  const vi = (linhas: ReturnType<typeof linha>[]) => por(build(comDados({ alcance: ok(alcanceComLinhas(BASE.canalId, BASE.hoje, linhas)) })).todos, 'videosComImpressao')

  it('vídeos com impressão contam Shorts também (não só os longos)', () => {
    medida(vi([linha(A, 5, 10, 0.1), linha(SHORT, 5, 4, 0.1)]), '2 de 58')
    medida(vi([linha(SHORT, 5, 4, 0.1)]), '1 de 58')
  })

  it('vídeos com impressão: o numerador é do mesmo conjunto do total; linha de vídeo que saiu do canal não conta ("5 de 3" não existe)', () => {
    medida(vi([linha(A, 5, 10, 0.1), linha('yt-que-saiu-do-canal', 5, 99, 0.1)]), '1 de 58')
    // só vídeo que saiu: zero medido, nunca a frase de ausência
    medida(vi([linha('yt-que-saiu-do-canal', 5, 99, 0.1)]), '0 de 58')
    // canal pequeno: nenhum numerador passa do total
    const w = proprioWorld({ mut: soOsPrimeirosLongos(2) })
    const [x, y] = w.ytIds as [string, string]
    const c = por(build(comDados({ alcance: ok(alcanceComLinhas(w.canalId, w.hoje, [linha(x, 5, 3, 0.1), linha(y, 5, 3, 0.1), linha('s1', 5, 3, 0.1), linha('s2', 6, 3, 0.1), linha('s3', 7, 3, 0.1)])) }, soOsPrimeirosLongos(2))).todos, 'videosComImpressao')
    medida(c, '2 de 2')
  })

  it('cliques sem CTR: a frase do motivo aparece UMA vez na célula (a palavra "não medido" não se repete) e o texto é exato', () => {
    const c = por(build(comDados({ alcance: ok(alcanceComLinhas(BASE.canalId, BASE.hoje, [linha(A, 5, 20, 0.1), linha(A, 6, 10, null)])) })).todos, 'cliques')
    naoMedida(c, 'não medido: o YouTube não informou a taxa de clique de algum dia com impressões')
    expect(FRASE_CTR).toBe(c.missing)
    const todoTexto = [c.missing, c.label, c.base].join(' | ')
    expect(todoTexto.split('não medido')).toHaveLength(2) // uma ocorrência
    expect(c.base).toContain('Algum dia com impressões veio sem a taxa de clique, então o total não é calculado.')
  })

  it('views/dia: a coleta que terminou há 7 dias ainda vale, a de 8 dias já "parou" (o `hoje` do modelo chega a vpdDoCanal sem deslocamento)', () => {
    const w = BASE
    const com = (atras: number) => {
      const diario = { acesso: 'ok' as const, dado: diarioCheio(w.canalId, w.ytIds, addDays(w.hoje, -(atras - 2))) } // termina em hoje - atras
      return por(build(comDados({ diario })).todos, 'vpdVideo')
    }
    const em7 = com(7)
    expect(em7.missing).toBeNull()
    expect(em7.value).not.toBeNull()
    const em8 = com(8)
    naoMedida(em8, `a coleta diária deste canal parou em ${w.dm(addDays(w.hoje, -8))}`)
  })
})

function violacoesDeImport(src: string): string[] {
  const v: string[] = []
  if (/from\s+['"][^'"]*proprio\/ler['"]/.test(src)) v.push('importa os leitores')
  if (/from\s+['"][^'"]*proprio\/edicao['"]/.test(src)) v.push('importa a prova de edição')
  if (/import\s+(?!type\b)[^'"]*from\s+['"]\.\/dados['"]/.test(src)) v.push('importa valor do módulo de servidor')
  if (/import\s+['"]server-only['"]/.test(src)) v.push('marca o modelo como módulo de servidor')
  return v
}
