// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildOrigem, videoNovo, videosDaOrigem, type EntradaOrigem, type PeriodoEntrada, type BlocoView } from '@/app/cms/(authed)/youtube/competitors/_proprio/origem-model'
import { addDays } from '@/lib/youtube/coleta/day-pt'
import { CONJUNTOS_DIMENSOES, type ConjuntoDim, type DiaLido, type EstadoConjunto, type LinhaBasica } from '@/lib/youtube/observatorio/proprio/dimensoes-estado'
import type { ConjuntoLido, DetalheCanal, DimensoesCanal, LinhaDetalhe } from '@/lib/youtube/observatorio/proprio/ler-dimensoes'
import type { OrigemLida } from '@/app/cms/(authed)/youtube/competitors/_proprio/dados-origem'

const HOJE = '2026-10-13', ATE = '2026-10-11', LIGADO = '2026-10-04'
const dmF = (d: string) => d.slice(8, 10) + '/' + d.slice(5, 7)
const dmyF = (d: string) => dmF(d) + '/' + d.slice(0, 4)
const nF = (x: number) => x.toLocaleString('pt-BR')
const dias = (de: string, ate: string): string[] => { const o: string[] = []; for (let d = de; d <= ate; d = addDays(d, 1)) o.push(d); return o }

type Dia = { base: number | null; linhas: Record<string, number> }
function conjunto<L extends LinhaBasica>(c: ConjuntoDim, lista: Array<[string, Dia]>, extra: (v: string, n: number) => Partial<L> = () => ({}), estado: EstadoConjunto = { tipo: 'coletado' }, desde: string = LIGADO): ConjuntoLido<L> {
  const d = lista.map(([dia, x]): DiaLido<L> => ({
    dia, coberto: true, baseMedida: x.base !== null, base: x.base, antesDoInicio: false, desde,
    linhas: Object.entries(x.linhas).map(([v, views], i) => ({ valor: v, views, minutos: null, ...extra(v, i) } as unknown as L)),
  }))
  return { conjunto: c, estado, videos: [{ ytId: 'v1', dias: d }] }
}
const MED = dias('2026-10-04', ATE) // 8 dias
const TIP7 = dias(addDays(ATE, -6), ATE) // 7 dias
// 3.185 = 1.338 + 573 + 478 + 319 + 223 + 76 + 178 (omitido) em 7 dias, 455 por dia
const dia7 = (i: number): Dia => i < 6
  ? { base: 455, linhas: { YT_SEARCH: 191, RELATED_VIDEO: 82, SUBSCRIBER: 68, SHORTS: 45, EXT_URL: 31, PLAYLIST: 10 } }
  : { base: 455, linhas: { YT_SEARCH: 192, RELATED_VIDEO: 81, SUBSCRIBER: 70, SHORTS: 49, EXT_URL: 37, PLAYLIST: 16 } }

function dims(over: Partial<Record<ConjuntoDim, ConjuntoLido<LinhaBasica>>> = {}, lista: string[] = TIP7): DimensoesCanal {
  const t = lista.map((d, i): [string, Dia] => [d, dia7(i)])
  const aparelho = lista.map((d): [string, Dia] => [d, { base: 455, linhas: { 'MOBILE|ANDROID': 280, 'DESKTOP|WINDOWS': 100, 'TV|X': 55, 'TABLET|IOS': 10 } }])
  const pais = lista.map((d): [string, Dia] => [d, { base: 455, linhas: { BR: 320, PT: 45, US: 30, ES: 20, AR: 10, FR: 9, DE: 8, IT: 7, MX: 6 } }])
  const insc = lista.map((d): [string, Dia] => [d, { base: 455, linhas: { SUBSCRIBED: 160, UNSUBSCRIBED: 290 } }])
  const alc = lista.map((d): [string, Dia] => [d, { base: 5900, linhas: { 'YT_SEARCH|MOBILE|ANDROID': 3000, 'RELATED_VIDEO|MOBILE|ANDROID': 1800, 'EXT_URL|MOBILE|ANDROID': 100, 'SHORTS|MOBILE|ANDROID': 900 } }])
  const extraAlc = (): Partial<LinhaBasica> => ({})
  return {
    canalId: 'c', de: lista[0]!, ate: lista[lista.length - 1]!, descartados: 0,
    conjuntos: {
      trafego: over.trafego ?? conjunto('trafego', t), dispositivo: over.dispositivo ?? conjunto('dispositivo', aparelho), pais: over.pais ?? conjunto('pais', pais),
      inscrito: over.inscrito ?? conjunto('inscrito', insc), alcance_dim: over.alcance_dim ?? conjunto('alcance_dim', alc, extraAlc),
    } as DimensoesCanal['conjuntos'],
  }
}
const SENT_TERMO = 'sentinela-termo-xyz', SENT_SITE = 'sentinela.example'
function detalhe(lista: string[] = TIP7, vazio = false): DetalheCanal {
  const d = lista.map((dia): DiaLido<LinhaDetalhe> => ({
    dia, coberto: true, baseMedida: true, base: 455, antesDoInicio: false, desde: LIGADO,
    linhas: vazio ? [] : [
      { valor: '5|h1', sourceType: '5', detail: SENT_TERMO, rotulo: 'Pesquisa', catalogado: true, tipoDetalhe: 'termo' as never, views: 10, minutos: null },
      { valor: '9|h2', sourceType: '9', detail: SENT_SITE, rotulo: 'Site', catalogado: true, tipoDetalhe: 'site' as never, views: 5, minutos: null },
    ],
  }))
  return { canalId: 'c', de: lista[0]!, ate: lista[lista.length - 1]!, descartados: 0, conjunto: { conjunto: 'detalhe', estado: { tipo: 'coletado' }, videos: [{ ytId: 'v1', dias: d }] } }
}
const ok = <T,>(dado: T) => ({ acesso: 'ok' as const, dado })
const per = (id: string, rotulo: string, de: string, ate: string, total: number | null = 3185, v: PeriodoEntrada['videosDoTotal'] = { naConta: 1, fora: 0, parados: 0, paradosDesde: null, comBuraco: 0 }): PeriodoEntrada => ({ id, rotulo, de, ate, totalDoPeriodo: total, videosDoTotal: v })
function entrada(over: Partial<EntradaOrigem> & { dimensoes?: DimensoesCanal } = {}): EntradaOrigem {
  const { dimensoes, ...resto } = over
  const origem: OrigemLida = { dimensoes: dimensoes ?? dims(), diario: null as never, diarioInteiro: null, trechos: 1 }
  return {
    tela: 'canal', nivel: 'tudo', origem: ok(origem), termos: ok(detalhe()), periodos: [per('7', '7 dias', TIP7[0]!, ATE)], publicadoEm: null, hojePt: HOJE, ligadoEm: LIGADO,
    publicacoes: new Map([['v1', '2020-01-01']]), podeEditar: true, dm: dmF, dmy: dmyF, n: nF, ...resto,
  }
}
/** Acrescenta o vídeo `ytId` ao conjunto, copiando os dias do primeiro: medido até `ate` (nulo = nunca coberto). */
function comVideo(c: ConjuntoLido<LinhaBasica>, ytId: string, ate: string | null): ConjuntoLido<LinhaBasica> {
  const base = c.videos[0]!
  return { ...c, videos: [...c.videos, { ytId, dias: base.dias.map(d => ({ ...d, coberto: ate != null && d.dia <= ate })) }] }
}
const grupo = (v: ReturnType<typeof buildOrigem>, i = 0) => v.periodos[i]!.grupo
const bloco = (v: ReturnType<typeof buildOrigem>, id: BlocoView['id'], i = 0) => grupo(v, i).blocos.find(b => b.id === id)!

describe('buildOrigem: típico, canal, 7 dias (os números do mockup)', () => {
  const v = buildOrigem(entrada())
  const o = bloco(v, 'origem')
  it('3.185 = 1.338 + 573 + 478 + 319 + 223 + 76 + 178 omitido; 42% e 18% na frase', () => {
    expect(o.estado).toBe('medido')
    expect(o.linhas.map(l => [l.chave, l.valor])).toEqual([['pesquisa', 1338], ['sugeridos', 573], ['navegacao', 478], ['shorts', 319], ['externa', 223], ['outras', 76], ['omitido', 178]])
    expect(o.linhas.reduce((s, l) => s + l.valor, 0)).toBe(3185)
    expect(o.linhas.reduce((s, l) => s + l.pct, 0)).toBe(100)
    expect(o.frase).toBe('42% das views vieram da pesquisa do YouTube e 18% de vídeos sugeridos; 6% omitido pelo YouTube.')
  })
  it('cobertura completa: sem o prefixo "Nos N dias" e a régua diz 7 de 7', () => {
    expect(o.frase).not.toMatch(/^Nos /)
    expect(o.cobertura).toBe('7 de 7 dias com a origem medida, de 05/10 a 11/10')
    expect(o.regua?.parcial).toBe(false)
  })
  it('rodapé com o total do período e a divisão que usa só os dias medidos', () => {
    expect(o.rodape).toBe('Views no período todo: 3.185. A divisão acima usa só as 3.185 views dos dias medidos.')
  })
  it('o nome das linhas e o rótulo de leitor de tela', () => {
    expect(o.linhas[0]!.rotulo).toBe('Pesquisa do YouTube')
    expect(o.linhas[0]!.rotuloLeitor).toBe('Pesquisa do YouTube: 42%, 1.338')
  })
  it('aparelho, país e inscritos somam o total medido; as frases', () => {
    const ap = bloco(v, 'aparelho'), pa = bloco(v, 'pais'), ins = bloco(v, 'inscritos')
    expect(ap.linhas.reduce((s, l) => s + l.valor, 0)).toBe(3185)
    expect(pa.linhas.reduce((s, l) => s + l.valor, 0)).toBe(3185)
    expect(ins.linhas.reduce((s, l) => s + l.valor, 0)).toBe(3185)
    expect(ap.frase).toMatch(/^62% das views vieram de celular/)
    expect(pa.frase).toMatch(/das views vieram do Brasil e \d+% de Portugal/)
    expect(ins.frase).toMatch(/^64% das views vieram de quem não é inscrito/)
    expect(pa.linhas.map(l => l.chave)).toContain('outros')
    expect(pa.linhas.filter(l => l.tipo === 'valor').length).toBe(7)
  })
  it('impressões por origem: sem "Sites e apps de fora"; o que chegou lá entra em "Outras origens" e a soma fecha', () => {
    const im = bloco(v, 'impressoes')
    expect(im.linhas.map(l => l.chave)).not.toContain('externa')
    expect(im.linhas.reduce((s, l) => s + l.valor, 0)).toBe(41300)
    expect(im.frase).toMatch(/^Seus vídeos foram mostrados 41\.300 vezes/)
  })
  it('a página do vídeo diz "este vídeo foi mostrado"; a do canal, "seus vídeos"', () => {
    expect(bloco(buildOrigem(entrada({ tela: 'video' })), 'impressoes').frase).toMatch(/^Este vídeo foi mostrado/)
  })
  it('termos e sites: a busca líder, o site líder e a comparação com o total da pesquisa', () => {
    const t = bloco(v, 'termos')
    expect(t.subListas?.map(s => s.id)).toEqual(['termos', 'sites'])
    expect(t.subListas![0]!.frase).toBe(`A busca que mais trouxe gente foi “${SENT_TERMO}”, com 70 views.`)
    expect(t.subListas![1]!.frase).toBe(`O site que mais trouxe gente foi ${SENT_SITE}, com 35 views.`)
    expect(t.subListas![0]!.comparacao).toBe('Das 1.338 views da pesquisa: 70 com termo, 1.268 omitidas pelo YouTube.')
  })
  it('o seletor e a dica', () => {
    expect(v.padrao).toBe('7')
    expect(v.dica).toBe('Dados até 11/10: o YouTube entrega com 2 a 3 dias de atraso.')
  })
})

describe('buildOrigem: cobertura parcial, magro, zero, não medido, revisão', () => {
  const P28 = per('28', '28 dias', addDays(ATE, -27), ATE, 19)
  it('28 dias com 8 medidos: o prefixo "Nos 8 dias medidos (04/10 a 11/10)" e a cobertura com a data de início', () => {
    const d = dims({}, MED)
    const v = buildOrigem(entrada({ dimensoes: d, periodos: [P28] }))
    const o = bloco(v, 'origem')
    expect(o.frase).toMatch(/^Nos 8 dias medidos \(04\/10 a 11\/10\), /)
    expect(o.cobertura).toContain('8 de 28 dias com a origem medida')
    expect(o.cobertura).toContain('Não medido: a coleta começou em 04/10/2026')
    expect(o.regua?.parcial).toBe(true)
  })
  it('magro: "só 5 views das 14, e 9 foram omitidas"', () => {
    const base = [2, 1, 3, 2, 1, 2, 2, 1]
    const lista = MED.map((d, i): [string, Dia] => [d, { base: base[i]!, linhas: i < 5 ? { YT_SEARCH: i < 3 ? 1 : 0 } : {} }])
    // pesquisa 3 + sugeridos 2 = 5; omitido 9
    lista[0]![1].linhas = { YT_SEARCH: 1 }; lista[1]![1].linhas = { YT_SEARCH: 1 }; lista[2]![1].linhas = { YT_SEARCH: 1, RELATED_VIDEO: 1 }; lista[3]![1].linhas = { RELATED_VIDEO: 1 }; lista[4]![1].linhas = {}
    const v = buildOrigem(entrada({ dimensoes: dims({ trafego: conjunto('trafego', lista) }, MED), periodos: [P28] }))
    expect(bloco(v, 'origem').frase).toBe('Nos 8 dias medidos (04/10 a 11/10), o YouTube disse a origem de só 5 views das 14, e 9 foram omitidas: com poucas views por origem ele esconde quase tudo.')
  })
  it('zero: "Nenhuma view nos 7 dias medidos"', () => {
    const lista = TIP7.map((d): [string, Dia] => [d, { base: 0, linhas: {} }])
    const o = bloco(buildOrigem(entrada({ dimensoes: dims({ trafego: conjunto('trafego', lista) }) })), 'origem')
    expect(o.estado).toBe('zero')
    expect(o.frase).toBe('Nenhuma view nos 7 dias medidos (05/10 a 11/10): não há o que repartir.'.replace('05/10', '05/10'))
  })
  it('não medido: a data da coleta e "0 de 7", nunca uma porcentagem', () => {
    const lista = TIP7.map((d): [string, Dia] => [d, { base: 455, linhas: {} }])
    const c = conjunto<LinhaBasica>('trafego', lista, () => ({}), { tipo: 'nao_coletado' }, '2026-10-14')
    for (const v of c.videos) for (const d of v.dias) { d.coberto = false }
    const o = bloco(buildOrigem(entrada({ dimensoes: dims({ trafego: c }) })), 'origem')
    expect(o.estado).toBe('nao_medido')
    expect(o.frase).toBe('A coleta começa em 14/10. Antes dessa data não guardamos a origem; não é zero.')
    expect(o.linhas).toEqual([])
    expect(JSON.stringify(o)).not.toMatch(/\d+%/)
    expect(o.metodo).toContain('Quando a coleta começar, a soma das origens mais o omitido será igual ao total.')
  })
  it('revisão: a soma das origens passa do total (826 contra 860)', () => {
    const lista = TIP7.map((d, i): [string, Dia] => [d, { base: i === 0 ? 100 : 121, linhas: { YT_SEARCH: i === 0 ? 100 : 121, RELATED_VIDEO: i === 0 ? 0 : 0 } }])
    lista[3]![1] = { base: 121, linhas: { YT_SEARCH: 121, RELATED_VIDEO: 34 } }
    const v = buildOrigem(entrada({ dimensoes: dims({ trafego: conjunto('trafego', lista) }) }))
    const o = bloco(v, 'origem')
    expect(o.estado).toBe('em_revisao')
    expect(o.frase).toBe('Não mostramos de onde vêm as views por enquanto: a origem está em revisão.')
    expect(o.aviso).toMatch(/^Em revisão: as origens somaram mais views do que o total/)
    expect(o.metodo).toContain('Aqui a soma das origens passou do total, por isso a divisão não aparece até conferir.')
    expect(bloco(v, 'termos').subListas![0]!.comparacao).toBe('Sem comparar com o total da pesquisa: a origem está em revisão.')
    expect(o.linhas).toEqual([])
  })
  it('conjunto em erro com dias medidos: os dias continuam e o aviso diz até quando', () => {
    const lista = MED.map((d, i): [string, Dia] => [d, dia7(i)])
    const c = conjunto<LinhaBasica>('trafego', lista, () => ({}), { tipo: 'coleta_em_erro', outcome: 'desconhecido', comDados: true })
    const o = bloco(buildOrigem(entrada({ dimensoes: dims({ trafego: c }, MED), periodos: [per('28', '28 dias', addDays(ATE, -27), ATE)] })), 'origem')
    expect(o.estado).toBe('medido')
    expect(o.aviso).toMatch(/A última busca falhou.*dias medidos até 11\/10/)
  })
  it('conjunto desligado sem dias: não medido com a frase da coleta desligada', () => {
    const lista = TIP7.map((d): [string, Dia] => [d, { base: 455, linhas: {} }])
    const c = conjunto<LinhaBasica>('trafego', lista, () => ({}), { tipo: 'passo_desligado', comDados: false })
    for (const v of c.videos) for (const d of v.dias) d.coberto = false
    expect(bloco(buildOrigem(entrada({ dimensoes: dims({ trafego: c }) })), 'origem').frase).toBe('A coleta da origem está desligada.')
  })
  it('a terceira fatia: o valor que o catálogo não conhece (inscritos) não some nem vira omitido', () => {
    const lista = TIP7.map((d): [string, Dia] => [d, { base: 100, linhas: { SUBSCRIBED: 50, UNSUBSCRIBED: 20, SITUACAO_NOVA: 10 } }])
    const b = bloco(buildOrigem(entrada({ dimensoes: dims({ inscrito: conjunto('inscrito', lista) }) })), 'inscritos')
    const nc = b.linhas.find(l => l.tipo === 'nao_catalogado')
    expect(nc?.valor).toBe(70)
    expect(b.linhas.find(l => l.tipo === 'omitido')?.valor).toBe(140)
    expect(b.linhas.reduce((s, l) => s + l.valor, 0)).toBe(700)
    expect(b.linhas.reduce((s, l) => s + l.pct, 0)).toBe(100)
    expect(b.frase).toContain('de valores que ainda não sabemos nomear')
  })
  it('nenhuma porcentagem aparece quando o bloco não é medido', () => {
    const lista = TIP7.map((d): [string, Dia] => [d, { base: 455, linhas: {} }])
    const c = conjunto<LinhaBasica>('inscrito', lista, () => ({}), { tipo: 'nao_coletado' })
    for (const v of c.videos) for (const d of v.dias) d.coberto = false
    const b = bloco(buildOrigem(entrada({ dimensoes: dims({ inscrito: c }) })), 'inscritos')
    expect(b.estado).toBe('nao_medido')
    expect(JSON.stringify(b)).not.toMatch(/\d+%/)
  })
  it('o ⓘ só cita a marca de contagem em período que cruza 24/08', () => {
    const sem = bloco(buildOrigem(entrada()), 'origem')
    expect(sem.metodo.join(' ')).not.toContain('24/08/2026')
    const lista = dias('2026-08-20', '2026-08-27').map((d, i): [string, Dia] => [d, dia7(i)])
    const cruza = bloco(buildOrigem(entrada({ dimensoes: dims({ trafego: conjunto('trafego', lista) }, dias('2026-08-20', '2026-08-27')), periodos: [per('7', '8 dias', '2026-08-20', '2026-08-27')] })), 'origem')
    expect(cruza.metodo.join(' ')).toContain('24/08/2026: o YouTube mudou como conta views')
  })
})

describe('buildOrigem: acesso, privacidade e erro', () => {
  it('origem negada: nível so-aviso sem nenhum número privado na vista (sentinela 73519, termo e endereço)', () => {
    const e = entrada({ nivel: 'so-aviso', origem: { acesso: 'negado' }, termos: { acesso: 'negado' } })
    const v = buildOrigem(e)
    const json = JSON.stringify(v)
    expect(v.periodos).toEqual([])
    expect(v.semAcesso?.blocos).toHaveLength(7)
    for (const s of ['73519', SENT_TERMO, SENT_SITE]) expect(json).not.toContain(s)
    expect(json.match(/\d+/g)?.join(',')).toBe('7')
  })
  it('so-aviso mesmo com dado na mão: a vista não vaza (a fixture traz os sentinelas)', () => {
    const v = buildOrigem(entrada({ nivel: 'so-aviso', periodos: [per('7', '7 dias', TIP7[0]!, ATE, 73519)] }))
    const json = JSON.stringify(v)
    for (const s of ['73519', SENT_TERMO, SENT_SITE, '3.185']) expect(json).not.toContain(s)
  })
  it('termos negados com origem ok e quem não edita: bloco de bloqueio e os outros com número; sem o termo e o endereço', () => {
    const v = buildOrigem(entrada({ nivel: 'sem-termos', termos: { acesso: 'negado' }, podeEditar: false }))
    const t = bloco(v, 'termos')
    expect(t.estado).toBe('bloqueado')
    expect(t.bloqueio).toBe('Você não vê este dado. Termos de pesquisa e sites de fora só aparecem para quem edita o site.')
    expect(bloco(v, 'origem').linhas.length).toBeGreaterThan(0)
    const json = JSON.stringify(v)
    expect(json).not.toContain(SENT_TERMO); expect(json).not.toContain(SENT_SITE)
  })
  it('termos em erro com origem ok: só o bloco de termos em erro, sem "Nenhum termo apareceu" nem "Você não vê este dado"', () => {
    const v = buildOrigem(entrada({ termos: { acesso: 'erro' } }))
    const t = bloco(v, 'termos')
    expect(t.estado).toBe('erro')
    expect(t.erro).toContain('Não conseguimos ler agora')
    expect(JSON.stringify(v)).not.toContain('Nenhum termo apareceu')
    expect(JSON.stringify(v)).not.toContain('Você não vê este dado')
    for (const id of ['origem', 'aparelho', 'pais', 'inscritos'] as const) expect(bloco(v, id).estado).toBe('medido')
  })
  it('termos negados e podeEditar: erro, não o bloqueio; sem podeEditar: bloqueio', () => {
    expect(bloco(buildOrigem(entrada({ termos: { acesso: 'negado' }, podeEditar: true })), 'termos').estado).toBe('erro')
    expect(bloco(buildOrigem(entrada({ termos: { acesso: 'negado' }, podeEditar: false })), 'termos').estado).toBe('bloqueado')
  })
  it('origem em erro: o grupo inteiro vira UM bloco de erro (um alerta e um botão, não seis)', () => {
    const v = buildOrigem(entrada({ origem: { acesso: 'erro' } }))
    expect(grupo(v).blocos).toHaveLength(1)
    expect(grupo(v).blocos[0]!.estado).toBe('erro')
    expect(grupo(v).blocos[0]!.erro).toContain('Não conseguimos ler agora')
  })
  it('origem negada nos níveis tudo e sem-termos (as duas provas divergem): bloco de erro, nunca o grupo mudo', () => {
    for (const nivel of ['tudo', 'sem-termos'] as const) {
      const v = buildOrigem(entrada({ nivel, origem: { acesso: 'negado' } }))
      expect(grupo(v).blocos).toHaveLength(1)
      expect(grupo(v).blocos[0]!.estado).toBe('erro')
    }
  })
  it('sem-termos com os termos LIDOS e cheios de sentinela: o bloco é o bloqueio e a vista não leva o termo nem o endereço (mata o mutante do ramo sem-termos)', () => {
    const v = buildOrigem(entrada({ nivel: 'sem-termos', termos: ok(detalhe()), podeEditar: true }))
    expect(bloco(v, 'termos').estado).toBe('bloqueado')
    const json = JSON.stringify(v)
    expect(json).not.toContain(SENT_TERMO); expect(json).not.toContain(SENT_SITE)
  })
  it('o total de "Desde" sem número diz o motivo: teto (permanente) é diferente de erro (passageiro)', () => {
    const tudo = (motivo: 'teto' | 'erro') => buildOrigem(entrada({
      periodos: [per('tudo', 'Desde 2024', TIP7[0]!, ATE, null, null)],
      origem: ok({ dimensoes: dims(), diario: null as never, diarioInteiro: null, motivoInteiro: motivo, trechos: 1 }),
    })).periodos[0]!.grupo.total
    expect(tudo('teto')).toBe('não medido: o canal passou do tamanho que esta tela lê de uma vez')
    expect(tudo('erro')).toBe('Não conseguimos ler agora. Tente de novo.')
    expect(tudo('teto')).not.toBe(tudo('erro'))
  })
  it('termos vazios com omitido na origem: "Nenhum termo apareceu"; sem lista, a comparação "Sem comparar" quando os dias diferem', () => {
    const v = buildOrigem(entrada({ termos: ok(detalhe(TIP7, true)) }))
    const s = bloco(v, 'termos').subListas![0]!
    expect(s.frase).toBe('Nenhum termo apareceu. O YouTube só mostra termos que trouxeram várias views; as 1.338 views da pesquisa ficaram sem termo (omitido pelo YouTube).')
  })
  it('termos medidos em mais dias que a origem: "Sem comparar com o total da pesquisa: ... 8 dos 34 dias"', () => {
    const longos = dias(addDays(ATE, -33), ATE)
    const v = buildOrigem(entrada({ dimensoes: dims({}, MED), termos: ok(detalhe(longos)), periodos: [per('90', '90 dias', addDays(ATE, -33), ATE)] }))
    expect(bloco(v, 'termos').subListas![0]!.comparacao).toBe('Sem comparar com o total da pesquisa: a origem foi medida em 8 dos 34 dias desta lista.')
  })
})

describe('buildOrigem: vídeos fora, parados, totais e vídeo novo', () => {
  it('um vídeo fora da conta: a linha "1 de 2 vídeos fora desta conta" aparece no bloco', () => {
    const d = dims()
    d.conjuntos.trafego = comVideo(d.conjuntos.trafego, 'v2', null)
    const v = buildOrigem(entrada({ dimensoes: d, publicacoes: new Map([['v1', '2020-01-01'], ['v2', '2020-01-01']]) }))
    expect(bloco(v, 'origem').linhasDeContagem).toContain('1 de 2 vídeos fora desta conta: sem leitura no período.')
  })
  it('total de 34 dos 35 vídeos: a célula e o rodapé dizem "de 34 dos 35 vídeos"', () => {
    const v = buildOrigem(entrada({ periodos: [per('7', '7 dias', TIP7[0]!, ATE, 3185, { naConta: 34, fora: 1, parados: 0, paradosDesde: null, comBuraco: 0 })] }))
    expect(grupo(v).total).toBe('3.185 de 34 dos 35 vídeos')
    expect(bloco(v, 'origem').rodape).toContain('Views no período todo: 3.185 de 34 dos 35 vídeos.')
  })
  it('um vídeo parado: a linha com a data; na página do vídeo, "Sem leitura depois de dd/mm."', () => {
    const longos = dias('2026-09-10', ATE)
    const d = dims({}, longos)
    d.conjuntos.trafego = comVideo(d.conjuntos.trafego, 'v2', '2026-09-15')
    const mk = (tela: 'canal' | 'video') => bloco(buildOrigem(entrada({ tela, dimensoes: d, publicacoes: new Map([['v1', '2020-01-01'], ['v2', '2020-01-01']]), periodos: [per('28', '28 dias', '2026-09-14', ATE)] })), 'origem')
    expect(mk('canal').linhasDeContagem).toContain('1 de 2 vídeos sem leitura depois de 15/09: os dias seguintes contam só os outros.')
    expect(mk('video').linhasDeContagem).toContain('Sem leitura depois de 15/09.')
  })
  it('total nulo por buraco: a célula lê não medido com a contagem, e o rodapé tem uma frase só', () => {
    const p = per('90', '90 dias', TIP7[0]!, ATE, null, { naConta: 35, fora: 0, parados: 0, paradosDesde: null, comBuraco: 1 })
    const v = buildOrigem(entrada({ periodos: [p] }))
    expect(grupo(v).total).toBe('não medido: 34 de 35 vídeos com o período inteiro medido')
    expect(bloco(v, 'origem').rodape).toBe('A divisão acima usa só as 3.185 views dos dias medidos.')
  })
  it('vídeo novo (menos de 3 dias): "Ainda não existe" em todos os blocos, com a primeira leitura', () => {
    expect(videoNovo('2026-10-12', HOJE)).toBe(true)
    expect(videoNovo('2026-10-10', HOJE)).toBe(false)
    const v = buildOrigem(entrada({ tela: 'video', publicadoEm: '2026-10-12' }))
    for (const b of grupo(v).blocos) {
      expect(b.estado).toBe('ainda_nao_existe')
      expect(b.frase).toBe('Ainda não existe. O YouTube entrega a origem das views 2 a 3 dias depois da publicação. Primeira leitura em 15/10.')
    }
  })
  it('página do vídeo, cobertura_parcial sem vídeo na conta: a frase própria, nunca "faltam 1 de 1"', () => {
    const lista = TIP7.map((d): [string, Dia] => [d, { base: 455, linhas: {} }])
    const c = conjunto<LinhaBasica>('trafego', lista)
    for (const v of c.videos) for (const d of v.dias) d.coberto = false
    const p = per('7', '7 dias', TIP7[0]!, ATE, null, { naConta: 0, fora: 1, parados: 0, paradosDesde: null, comBuraco: 0 })
    const o = bloco(buildOrigem(entrada({ tela: 'video', dimensoes: dims({ trafego: c }), periodos: [p] })), 'origem')
    expect(JSON.stringify(o)).not.toContain('faltam 1 de 1')
    expect(o.estado).toBe('nao_medido')
  })
  it('publicação nula: "Desde a publicação" não está em periodos (quem monta não o inclui) e o modelo não quebra', () => {
    expect(() => buildOrigem(entrada({ publicadoEm: null, tela: 'video' }))).not.toThrow()
  })
})

describe('buildOrigem: a faixa de duas células do topo da aba (Yannis I3)', () => {
  const faixaDe = (v: ReturnType<typeof buildOrigem>, i = 0) => grupo(v, i).faixa!
  it('medido: "views no período" com o total e as datas, e "dias com origem medida" com "{N}" e "de {M}"', () => {
    const f = faixaDe(buildOrigem(entrada()))
    expect(f.views).toEqual({ rotulo: 'views no período', valor: '3.185', sub: '05/10 a 11/10' })
    expect(f.dias).toEqual({ rotulo: 'dias com origem medida', valor: '7', sub: 'de 7' })
  })
  it('vídeo fora da conta: o total diz "de N dos M vídeos" na subfrase', () => {
    const v = { naConta: 34, fora: 1, parados: 0, paradosDesde: null, comBuraco: 0 }
    expect(faixaDe(buildOrigem(entrada({ periodos: [per('7', '7 dias', TIP7[0]!, ATE, 3185, v)] }))).views.sub).toBe('05/10 a 11/10 · de 34 dos 35 vídeos')
  })
  it('total nulo: o valor lê "não medido" e a subfrase traz o motivo do grupo', () => {
    const f = faixaDe(buildOrigem(entrada({ periodos: [per('7', '7 dias', TIP7[0]!, ATE, null, { naConta: 35, fora: 0, parados: 0, paradosDesde: null, comBuraco: 2 })] })))
    expect(f.views.valor).toBe('não medido')
    expect(f.views.sub).toBe('não medido: 33 de 35 vídeos com o período inteiro medido')
  })
  it('antes da coleta: "0" e "de 7 · a coleta começa em dd/mm", nunca uma porcentagem', () => {
    const lista = TIP7.map((d): [string, Dia] => [d, { base: 455, linhas: {} }])
    const c = conjunto<LinhaBasica>('trafego', lista, () => ({}), { tipo: 'nao_coletado' }, '2026-10-14')
    for (const vd of c.videos) for (const d of vd.dias) { d.coberto = false }
    const f = faixaDe(buildOrigem(entrada({ dimensoes: dims({ trafego: c }) })))
    expect(f.dias).toEqual({ rotulo: 'dias com origem medida', valor: '0', sub: 'de 7 · a coleta começa em 14/10' })
  })
  it('origem em erro: o símbolo de sem número e "não conseguimos ler agora"', () => {
    const f = faixaDe(buildOrigem(entrada({ origem: { acesso: 'erro' } })))
    expect(f.dias).toEqual({ rotulo: 'dias com origem medida', valor: '—', sub: 'de 7 · não conseguimos ler agora' })
  })
  it('origem em revisão: o número medido e "· origem em revisão"', () => {
    const lista = TIP7.map((d, i): [string, Dia] => [d, { base: i === 0 ? 100 : 121, linhas: { YT_SEARCH: i === 0 ? 100 : 121 } }])
    lista[3]![1] = { base: 121, linhas: { YT_SEARCH: 121, RELATED_VIDEO: 34 } }
    const f = faixaDe(buildOrigem(entrada({ dimensoes: dims({ trafego: conjunto('trafego', lista) }) })))
    expect(f.dias.sub).toBe('de 7 · origem em revisão')
    expect(f.dias.valor).toBe('7')
  })
  it('na tela do vídeo não há faixa (ela é do topo da aba do canal)', () => {
    expect(grupo(buildOrigem(entrada({ tela: 'video' })), 0).faixa ?? null).toBeNull()
  })
})

describe('videosDaOrigem', () => {
  it('inclui Short e vídeo não acompanhado e não inclui vídeo de outro canal; do mais novo ao mais velho', () => {
    const obs = { videos: [
      { ytId: 'a', ch: 'c1', pub: 1 }, { ytId: 'b', ch: 'c1', pub: 3 }, { ytId: 'x', ch: 'c2', pub: 5 }, { ytId: 'c', ch: 'c1', pub: 2 },
    ] }
    expect(videosDaOrigem(obs, 'c1')).toEqual(['b', 'c', 'a'])
  })
})

describe('origem-model: fronteira', () => {
  it('o arquivo não importa React, server-only nem os leitores (só tipos de dados-origem)', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync(__dirname + '/../../../src/app/cms/(authed)/youtube/competitors/_proprio/origem-model.ts', 'utf8')
    const imports = [...src.matchAll(/^import\s+(type\s+)?[^'"]*from\s+'([^']+)'/gm)]
    for (const [, tipo, de] of imports) {
      expect(de, de).not.toMatch(/^react|server-only|dados-termos|supabase/)
      // dos leitores e de dados-origem só TIPOS (apagados na compilação); nenhum import de valor
      if (/proprio\/ler(-retencao|-dimensoes|-diario-periodo)?$|dados-origem/.test(de!)) expect(tipo, de + ' só como tipo').toBeTruthy()
    }
  })
})
void CONJUNTOS_DIMENSOES
