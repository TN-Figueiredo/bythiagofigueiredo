// @vitest-environment node
// E5a T9 (mockup 17c): quem sobe e quem desce no nicho. Módulo puro: a leitura escolhida ordena, pinta e conta; as outras ficam no painel.
import { describe, it, expect } from 'vitest'
import { medido, naoMedido, type Medida } from '@/lib/youtube/observatorio/medidas/tipos'
import type { ValorDirecaoCanal, ValorDirecaoVideos } from '@/lib/youtube/observatorio/medidas/direcao'
import type { MedidasDoSite } from '@/lib/youtube/observatorio/medidas-telas/carregar-do-site'
import { MEASURE_RULES } from '@/lib/youtube/observatorio/medidas/regras'
import { mesmaIdadeExisteEm, somaDias } from '@/lib/youtube/observatorio/medidas-telas/calendario'
import { direcaoDoNicho, parseLeitura, type CanalDoNicho, type LeituraDaDirecao } from '@/app/cms/(authed)/youtube/competitors/_insights/direcao-nicho-model'

const HOJE = '2026-10-13'
const canal = (id: string, name = id): CanalDoNicho => ({ id, name, href: '/canal/' + id })

type M3a = Medida<ValorDirecaoCanal>
type M3b = Medida<ValorDirecaoVideos>
const dirDe = (v: number) => (v >= 0.1 ? 'subindo' : v <= -0.1 ? 'descendo' : 'igual') as ValorDirecaoCanal['direcao']
/** `variacao` com ganhos que a reproduzem: ganhoAnterior fixo em 100.000. */
const a = (variacao: number, ate = HOJE): M3a =>
  medido({ variacao, direcao: dirDe(variacao), ganhoRecente: Math.round(100_000 * (1 + variacao)), ganhoAnterior: 100_000 }, 3, { de: somaDias(ate, -56), ate, dias: 56 })
const b = (variacao: number, ate = HOJE): M3b =>
  medido({ variacao, direcao: dirDe(variacao), medianaRecente: Math.round(20_000 * (1 + variacao)), medianaAnterior: 20_000 }, 8, { de: somaDias(ate, -180), ate, dias: 180 })

interface Entrada { a?: M3a; b?: M3b; c?: M3b }
const nao: M3a = naoMedido('pouco_registro', { n: 11, fechaEm: '2026-11-27' })
function site(m: Record<string, Entrada | 'falhou'>): MedidasDoSite {
  const porCanal = new Map<string, unknown>(Object.entries(m).map(([id, e]) => [id, e === 'falhou' ? { naoCarregou: 'tempo_esgotado' } : {
    m3a: e.a ?? nao, porFormato: { long: { m3b: e.b ?? naoMedido('poucos_videos', { n: 1, minimo: 3 }), m3c: e.c ?? naoMedido('poucos_videos', { n: 0, minimo: 3 }) } },
  }]))
  return { porCanal, extras: { lido: false, causa: 'tempo_esgotado' }, falhas: [], esgotou: 0 } as unknown as MedidasDoSite
}
const O = (leitura: LeituraDaDirecao = 'a', hojeSP = HOJE, seusCanais: string[] = []) => ({ leitura, hojeSP, nicho: 'Viagem', seusCanais })

describe('direcaoDoNicho: os estados com dado ausente', () => {
  it('nenhum canal com 56 dias: todos não medidos com a data, frase sem número inventado', () => {
    const v = direcaoDoNicho(site({ x: {}, y: { a: naoMedido('pouco_registro', { n: 30, fechaEm: '2026-11-05' }) } }), [canal('x', 'Xis'), canal('y', 'Ypsilon')], O())
    expect(v.estado).toBe('normal')
    expect(v.frase).toBe('Nenhum canal do nicho Viagem tem medida em views nos últimos 28 dias ainda: o primeiro fecha em 05/11.')
    expect(v.linhas.map(l => [l.id, l.estado, l.motivo])).toEqual([['y', 'nao_medido', 'fecha em 05/11'], ['x', 'nao_medido', 'fecha em 27/11']])
    expect(v.linhas.every(l => l.posicao === '–' && l.texto === null)).toBe(true)
    expect(v.eixo).toBe(false)
    expect(v.contagem).toMatchObject({ sobem: 0, descem: 0, estaveis: 0, naoMedidos: 2 })
  })
  it('um canal no nicho: a régua diz que não há com quem comparar', () => {
    const v = direcaoDoNicho(site({ x: { a: a(0.42) } }), [canal('x')], O())
    expect(v.estado).toBe('um-canal')
    expect(v.frase).toBe('Só 1 canal no nicho Viagem, e ele sobe ▲ em views nos últimos 28 dias. Sem outro canal, não há com quem comparar.')
    expect(v.barra).toBeNull()
    expect(v.linhas[0]).toMatchObject({ posicao: '–', unico: 'Único canal do nicho: sem posição.' })
  })
  it('medidas não carregaram: o cartão em erro, sem posição nenhuma', () => {
    const v = direcaoDoNicho('erro', [canal('x'), canal('y')], O())
    expect(v.estado).toBe('erro')
    expect(v.linhas).toEqual([])
    expect(v.erro?.titulo).toBe('Não deu para carregar as views dos canais deste nicho.')
    expect(v.erro?.texto).toMatch(/^Os outros cartões desta tela carregaram\./)
    expect(v.frase).toBe('')
  })
  it('um canal que falhou fica "não carregou", depois dos não medidos, e não entra na posição', () => {
    const v = direcaoDoNicho(site({ x: { a: a(0.3) }, y: 'falhou', z: {} }), [canal('x'), canal('y'), canal('z')], O())
    expect(v.linhas.map(l => [l.id, l.estado, l.posicao])).toEqual([['x', 'medido', '1º'], ['z', 'nao_medido', '–'], ['y', 'nao_carregou', '–']])
    expect(v.contagem).toMatchObject({ naoMedidos: 1, naoCarregaram: 1 })
  })
  it('nicho sem canal: estado "sem-dado" com o texto do mockup e nenhuma barra', () => {
    const v = direcaoDoNicho(site({}), [], O())
    expect(v.estado).toBe('sem-dado')
    expect(v.semDado).toEqual({ titulo: 'Nenhum canal neste nicho', texto: 'Adicione um canal de Viagem para ver quem sobe e quem desce.' })
    expect(v.barra).toBeNull()
  })
  it('ganho anterior zero: "sem base para comparar", fora da posição e da contagem', () => {
    const v = direcaoDoNicho(site({ x: { a: a(0.3) }, y: { a: naoMedido('base_zero') }, z: { a: a(-0.3) } }), [canal('x'), canal('y'), canal('z')], O())
    const y = v.linhas.find(l => l.id === 'y')!
    expect(y).toMatchObject({ estado: 'sem_base', posicao: '–', texto: null, motivo: 'sem base para comparar', base: ['0 views nos 28 dias anteriores'] })
    expect(v.contagem).toMatchObject({ sobem: 1, descem: 1, estaveis: 0, naoMedidos: 1 })
    expect(v.frase).toBe('▲ 1 sobe, ▼ 1 desce e ＝ 0 ficam estáveis em views nos últimos 28 dias, no nicho Viagem. 1 canal ainda não pôde ser medido.')
    expect(v.linhas.map(l => l.id)).toEqual(['x', 'z', 'y'])
  })
})

describe('direcaoDoNicho: o calendário', () => {
  const chega = mesmaIdadeExisteEm()
  it('"Mesma idade" antes da data: botão "nenhum medido", nunca "0 medidos", e toda linha "fecha em dd/mm/aaaa"', () => {
    const v = direcaoDoNicho(site({ x: { a: a(0.3), c: b(0.5) }, y: {} }), [canal('x'), canal('y')], O('c'))
    const botao = v.botoes.find(k => k.key === 'c')!
    expect(botao).toMatchObject({ contagem: 'nenhum medido', nenhum: true })
    expect(v.botoes.map(k => k.contagem).join('|')).not.toMatch(/\b0 medidos/)
    expect(v.linhas.every(l => l.estado === 'nao_medido' && l.motivo === `fecha em ${chega.slice(8, 10)}/${chega.slice(5, 7)}/${chega.slice(0, 4)}`)).toBe(true)
    expect(v.frase).toMatch(/: o primeiro fecha em \d\d\/\d\d\/\d{4}\.$/)
    // sem inventar número: a medida do canal x na leitura c (que existe no dado) não aparece antes da data
    expect(v.linhas.every(l => l.texto === null)).toBe(true)
    expect(v.eixo).toBe(false)
  })
  it('"Mesma idade" depois da data, com nenhum canal medido: não medido com o motivo, nunca "0 medidos"', () => {
    const depois = somaDias(chega, 1)
    const v = direcaoDoNicho(site({ x: {}, y: {} }), [canal('x'), canal('y')], O('c', depois))
    expect(v.botoes.find(k => k.key === 'c')!.contagem).toBe('nenhum medido')
    expect(v.linhas.every(l => l.estado === 'nao_medido' && /precisa de 3$/.test(l.motivo ?? ''))).toBe(true)
    expect(v.frase).toBe('Nenhum canal do nicho Viagem tem medida nas views do vídeo típico dos longos publicados nos últimos 90 dias, medidas aos 30 dias de vida ainda.')
  })
  it('depois da data a leitura c usa a medida: base com "vídeo típico" e janelas de 90 dias', () => {
    const depois = somaDias(chega, 1)
    const v = direcaoDoNicho(site({ x: { c: b(0.5, depois) }, y: { c: b(-0.5, depois) } }), [canal('x'), canal('y')], O('c', depois))
    expect(v.linhas[0]).toMatchObject({ id: 'x', texto: '+50%', simbolo: 'sobe' })
    expect(v.linhas[0]!.base[0]).toBe('vídeo típico: 30.000 views contra 20.000')
    expect(v.linhas[0]!.base[1]).toMatch(/^publicados de \d\d\/\d\d a \d\d\/\d\d contra \d\d\/\d\d a \d\d\/\d\d$/)
  })
  it('o aviso de contagem some no dia seguinte ao último dia em que cruza', () => {
    const ultimo = somaDias(MEASURE_RULES.countChange, 2 * MEASURE_RULES.direction.windowDays - 1)
    const com = direcaoDoNicho(site({ x: { a: a(0.3, ultimo) } }), [canal('x'), canal('y')], O('a', ultimo))
    expect(com.avisos).toEqual([`Até ${ultimo.slice(8, 10)}/${ultimo.slice(5, 7)}, os 28 dias anteriores incluem a mudança de contagem do YouTube (24/08).`])
    const dia = somaDias(ultimo, 1)
    expect(direcaoDoNicho(site({ x: {} }), [canal('x'), canal('y')], O('a', dia)).avisos).toEqual([])
  })
  it('o aviso é só da leitura a', () => {
    const ultimo = somaDias(MEASURE_RULES.countChange, 2 * MEASURE_RULES.direction.windowDays - 1)
    expect(direcaoDoNicho(site({ x: {} }), [canal('x'), canal('y')], O('b', ultimo)).avisos).toEqual([])
  })
})

describe('direcaoDoNicho: a fronteira e a posição', () => {
  const um = (v: number) => direcaoDoNicho(site({ x: { a: a(v) } }), [canal('x'), canal('y')], O()).linhas.find(l => l.id === 'x')!
  it('9,68% é ▲ +10%; 9,4% é ＝ +9%', () => {
    expect(um(119_000 / 108_500 - 1)).toMatchObject({ simbolo: 'sobe', texto: '+10%' })
    expect(um(0.094)).toMatchObject({ simbolo: 'estavel', texto: '+9%' })
    expect(um(-0.094)).toMatchObject({ simbolo: 'estavel', texto: '−9%' })
  })
  it('três empatados são 2º e o seguinte é 5º, com "empate" escrito', () => {
    const v = direcaoDoNicho(site({ p: { a: a(0.5) }, q: { a: a(0.24) }, r: { a: a(0.24) }, s: { a: a(0.24) }, t: { a: a(0.1) } }),
      ['p', 'q', 'r', 's', 't'].map(i => canal(i)), O())
    expect(v.linhas.map(l => l.posicao)).toEqual(['1º', '2º', '2º', '2º', '5º'])
    expect(v.linhas.map(l => l.empate)).toEqual([false, true, true, true, false])
    expect(v.linhas[1]!.aria).toContain('empate')
  })
  it('+340% encosta na seta e o número continua escrito; −60% fica na borda sem seta', () => {
    const v = direcaoDoNicho(site({ x: { a: a(3.4) }, y: { a: a(-0.6) }, z: { a: a(-0.78) } }), [canal('x'), canal('y'), canal('z')], O())
    const l = (id: string) => v.linhas.find(k => k.id === id)!
    expect(l('x')).toMatchObject({ texto: '+340%', fora: 'acima', fracao: 0.95 })
    expect(l('y')).toMatchObject({ texto: '−60%', fora: null, fracao: 0.05 })
    expect(l('z')).toMatchObject({ texto: '−78%', fora: 'abaixo' })
  })
  it('ordem: maior inteiro primeiro; a ordem é da leitura escolhida, e as outras vão no painel', () => {
    const m = site({ x: { a: a(0.2), b: b(-0.4) }, y: { a: a(-0.2), b: b(0.4) } })
    const A = direcaoDoNicho(m, [canal('x'), canal('y')], O('a')), B = direcaoDoNicho(m, [canal('x'), canal('y')], O('b'))
    expect(A.linhas.map(l => l.id)).toEqual(['x', 'y'])
    expect(B.linhas.map(l => l.id)).toEqual(['y', 'x'])
    const painel = A.linhas[0]!.leituras
    expect(painel.map(p => [p.key, p.principal])).toEqual([['a', true], ['b', false], ['c', false]])
    expect(painel[1]).toMatchObject({ simbolo: 'desce', texto: '−40%' })
  })
  it('a base e as duas janelas de datas aparecem com números cheios', () => {
    const v = direcaoDoNicho(site({ x: { a: medido({ variacao: 612_000 / 431_000 - 1, direcao: 'subindo', ganhoRecente: 612_000, ganhoAnterior: 431_000 }, 3, { de: '2026-08-19', ate: '2026-10-13', dias: 56 }) } }),
      [canal('x'), canal('y')], O())
    expect(v.linhas[0]!.base).toEqual(['612.000 views contra 431.000', '16/09 a 13/10 contra 19/08 a 15/09'])
  })
})

describe('direcaoDoNicho: frases, botões e seu canal', () => {
  it('a frase do caso comum e a barra de contagem', () => {
    const v = direcaoDoNicho(site({ p: { a: a(0.5) }, q: { a: a(0.3) }, r: { a: a(-0.3) }, s: { a: a(0.01) }, t: {}, u: {} }), ['p', 'q', 'r', 's', 't', 'u'].map(i => canal(i)), O())
    expect(v.frase).toBe('▲ 2 sobem, ▼ 1 desce e ＝ 1 fica estável em views nos últimos 28 dias, no nicho Viagem. 2 canais ainda não puderam ser medidos.')
    expect(v.barra?.aria).toBe('2 sobem, 1 desce, 1 estável, 2 não medidos, de 6 canais')
    expect(v.botoes[0]).toMatchObject({ key: 'a', contagem: '4 de 6 medidos', pressed: true })
  })
  it('o botão sob a frase só existe quando nada está medido e outra leitura mede ao menos um canal', () => {
    const depois = somaDias(mesmaIdadeExisteEm(), 1)
    const m = site({ x: { b: b(0.2, depois) }, y: {} })
    const v = direcaoDoNicho(m, [canal('x'), canal('y')], O('a', depois))
    expect(v.sugestao).toEqual({ key: 'b', texto: 'Vídeos novos já mede 1 de 2.' })
    expect(direcaoDoNicho(m, [canal('x'), canal('y')], O('b', depois)).sugestao).toBeNull()
  })
  it('o seu canal aparece fora da régua sem nenhuma medida pedida para ele', () => {
    const lidos: string[] = []
    const m = site({ x: { a: a(0.3) }, y: { a: a(-0.3) } })
    const espiao = new Map(m.porCanal)
    const real = espiao.get.bind(espiao)
    espiao.get = (k: string) => { lidos.push(k); return real(k) }
    const v = direcaoDoNicho({ ...m, porCanal: espiao }, [canal('x'), canal('y')], O('a', HOJE, ['tnFigueiredo']))
    expect(v.seuCanal).toEqual([{ nome: 'tnFigueiredo', texto: 'seu canal · tnFigueiredo · fora desta régua' }])
    expect(new Set(lidos)).toEqual(new Set(['x', 'y']))
    expect(v.linhas.map(l => l.name)).not.toContain('tnFigueiredo')
    expect(v.info.seuCanal.at(-1)).toBe('Cálculo do Observatório sobre dados públicos do YouTube.')
  })
  it('o filtro Longos e Shorts não muda o cartão: a assinatura não recebe formato e a legenda diz', () => {
    const v = direcaoDoNicho(site({ x: { a: a(0.3) } }), [canal('x'), canal('y')], O())
    expect(v.legenda).toBe('Inclui Shorts e vídeos apagados. O filtro de formato não vale aqui.')
    expect(direcaoDoNicho.length).toBe(3)
  })
  it('as legendas e os títulos são os da tabela do NOTAS', () => {
    const m = site({ x: {} })
    expect(direcaoDoNicho(m, [canal('x'), canal('y')], O('b')).legenda).toBe('Só vídeos longos. Descer pode ser só idade: os mais velhos tiveram mais tempo.')
    expect(direcaoDoNicho(m, [canal('x'), canal('y')], O('c')).legenda).toBe('Compara cada vídeo aos 30 dias de vida, sem o efeito do tempo.')
    const v = direcaoDoNicho(m, [canal('x'), canal('y')], O())
    expect(v.titulo).toBe('Quem sobe e quem desce no nicho Viagem')
    expect(v.meta).toBe('Últimos 28 dias contra os 28 anteriores')
    expect(direcaoDoNicho(m, [canal('x'), canal('y')], O('b')).meta).toBe('Últimos 90 dias contra os 90 anteriores')
  })
  it('a leitura vem do ?leitura= e o padrão é o canal inteiro', () => {
    expect(parseLeitura(undefined)).toBe('a'); expect(parseLeitura('b')).toBe('b'); expect(parseLeitura('c')).toBe('c'); expect(parseLeitura('x')).toBe('a')
  })
  it('dia sem registro: "sem o registro de dd/mm" e a linha que diz quando volta a medir', () => {
    const v = direcaoDoNicho(site({ x: { a: naoMedido('sem_registro_na_borda', { desde: '2026-10-13' }) } }), [canal('x'), canal('y')], O())
    expect(v.linhas[0]).toMatchObject({ motivo: 'sem o registro de 13/10', base: ['volta a medir quando houver o dado de 13/10'] })
  })
  it('a progressão da hachura vem dos dias de registro (11 de 56)', () => {
    const v = direcaoDoNicho(site({ x: {} }), [canal('x'), canal('y')], O())
    expect(v.linhas[0]).toMatchObject({ progresso: 11 / 56, base: ['11 de 56 dias de registro'] })
  })
})

describe('direcaoDoNicho: falha de carga não é espera (Yannis I1, 17/10)', () => {
  it('todos os canais não carregaram: estado de erro, nunca "ainda"', () => {
    const v = direcaoDoNicho(site({ x: 'falhou', y: 'falhou' }), [canal('x'), canal('y')], O())
    expect(v.estado).toBe('erro')
    expect(v.linhas).toEqual([])
    expect(v.frase).toBe('')
  })
  it('parcial: a frase conta quem não carregou e a barra tem o 5º segmento, sem misturar com "não medido"', () => {
    const v = direcaoDoNicho(site({ x: { a: a(0.3) }, y: 'falhou', z: {} }), [canal('x'), canal('y'), canal('z')], O())
    expect(v.frase).toContain('1 canal não carregou.')
    expect(v.frase).toContain('1 canal ainda não pôde ser medido.')
    const seg = Object.fromEntries(v.barra!.segmentos.map(s => [s.tipo, s.n]))
    expect(seg).toMatchObject({ nao_carregou: 1, nao_medido: 1 })
    expect(v.barra!.aria).toContain('1 não carregou')
  })
  it('sem nenhum medido mas com um que não carregou: o "ainda" vem com a ressalva', () => {
    const v = direcaoDoNicho(site({ x: {}, y: 'falhou' }), [canal('x'), canal('y')], O())
    expect(v.frase).toMatch(/ainda.*1 canal não carregou\.$/)
  })
})

describe('direcaoDoNicho: views inteiras (Gio M-4)', () => {
  it('a mediana de vídeos novos nunca tem meia view', () => {
    const m = site({ x: { b: medido({ variacao: 0.1, direcao: 'subindo', medianaRecente: 47_806.5, medianaAnterior: 43_000 }, 8, { de: somaDias(HOJE, -180), ate: HOJE, dias: 180 }) } })
    const v = direcaoDoNicho(m, [canal('x')], O('b'))
    expect(v.linhas[0]!.base.join(' ')).not.toMatch(/,5/)
  })
})

describe('direcaoDoNicho: nota do período anterior incompleto (leituras b e c)', () => {
  const NOTA = 'em 1 canal falta histórico do período anterior'
  const medidas = () => site({ x: { b: b(0.3), c: b(0.3) }, y: { b: b(0.1), c: b(0.1) } })
  const canais = [canal('x'), canal('y')]
  it('leitura b com um canal não coberto: nota sob a frase, sem repetir no ⓘ', () => {
    const v = direcaoDoNicho(medidas(), canais, { ...O('b'), anteriorIncompleto: ['x'] })
    expect(v.avisos.some(t => t.includes(NOTA))).toBe(true)
    expect(v.info.leituras.some(t => t.includes(NOTA))).toBe(false)
  })
  it('sem nota quando todos cobertos, ausente ou na leitura a', () => {
    expect(direcaoDoNicho(medidas(), canais, { ...O('b'), anteriorIncompleto: [] }).avisos).toEqual([])
    expect(direcaoDoNicho(medidas(), canais, O('b')).avisos).toEqual([])
    const a1 = direcaoDoNicho(medidas(), canais, { ...O('a'), anteriorIncompleto: ['x'] })
    expect(a1.avisos.some(t => t.includes('falta histórico'))).toBe(false)
    expect(a1.info.leituras.some(t => t.includes('falta histórico'))).toBe(false)
  })
  it('plural com dois canais', () => {
    const v = direcaoDoNicho(medidas(), canais, { ...O('b'), anteriorIncompleto: ['x', 'y'] })
    expect(v.avisos.some(t => t.includes('em 2 canais falta histórico'))).toBe(true)
  })
})
