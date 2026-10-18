// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { AlvoAtivo } from '@/lib/youtube/watch/alvos'
import { atualizacoesDosAlvos, estadoDoDisparo, lerPassadas, type Passadas } from '@/lib/youtube/watch/disparo'
import type { OpcoesLeitor, ResultadoLeitor } from '@/lib/youtube/watch/leitor'
import { RENDERERS_TITULO } from '@/lib/youtube/teste-youtube/tipos'

const AGORA = Date.UTC(2026, 9, 18, 12, 0, 0)
const yt = (n: number): string => `v${String(n).padStart(10, '0')}`
const uuid = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function res(id: string, erro: string | null, comTitulo = true): ResultadoLeitor {
  return {
    leitura: {
      youtubeVideoId: id, lidaEm: new Date(AGORA).toISOString(), rodadaId: uuid(1), origemRede: 'vercel', idioma: erro === null ? 'pt-BR' : null, erro,
      tituloOficial: null, titulo_oficial_fonte: null, rendicoesSqp: null,
      titulosExibidos: RENDERERS_TITULO.map(renderer => ({ renderer, texto: erro === null && comTitulo ? 'T' : null })), miniaturas: [],
    },
    http: erro === null ? 200 : null, jogadorBloqueado: false,
  }
}
function alvo(n: number, o: Partial<AlvoAtivo> = {}): AlvoAtivo {
  return { id: n, siteId: uuid(99), ytId: yt(n), horaBaseMin: 10, rodadasPorDia: 4, proximaRodadaEm: new Date(AGORA - 60_000).toISOString(),
    coletaAte: new Date(AGORA + 10 * 86_400_000).toISOString(), motivoAte: 'janela_concorrente', extensoesCurtas: 0, indisponivelSeguidas: 0, rodadas: 0, temTesteNosso: false, ...o }
}
const alvos = (n: number): AlvoAtivo[] => Array.from({ length: n }, (_, i) => alvo(i + 1))
const base = { origemRede: 'vercel' as const, agora: () => AGORA, ateMs: AGORA + 27_000, novoUuid: (() => { let n = 0; return () => uuid(++n) })() }
const extra = { sobraram: 0, extensaoFalhou: 0, gravou: true, candidatosEsperados: 3, alvosAtivos: 3 }

/** Monta Passadas à mão: `n` alvos × `por` leituras com o mesmo erro. */
function passadas(n: number, por: number, erro: string | null, comTitulo = true): Passadas {
  const resultados = new Map<number, ResultadoLeitor[]>()
  for (let i = 1; i <= n; i++) resultados.set(i, Array.from({ length: por }, () => res(yt(i), erro, comTitulo)))
  return { resultados, disjuntor: false, tentativas: n * por }
}

describe('A8 lerPassadas e disjuntor', () => {
  for (const codigo of ['http_429', 'consentimento', 'verificacao_robo']) {
    it(`3 respostas ${codigo} param as leituras novas: erro bloqueado, as feitas ficam`, async () => {
      let chamadas = 0
      const ler = async (id: string): Promise<ResultadoLeitor> => { chamadas++; return res(id, chamadas <= 1 ? null : codigo) }
      const p = await lerPassadas(alvos(4), ler, base)
      expect(p.disjuntor).toBe(true)
      expect(chamadas).toBe(p.tentativas)
      expect(chamadas).toBeLessThan(12)
      expect([...p.resultados.values()].flat().some(r => r.leitura.erro === null)).toBe(true)
      expect(estadoDoDisparo(p, extra)).toMatchObject({ estado: 'erro', motivo: 'bloqueado' })
    })
  }
  it('sem bloqueio: 3 passadas por alvo, um rodadaId por alvo', async () => {
    const vistos: Array<[string, string]> = []
    const p = await lerPassadas(alvos(3), async (id, o) => { vistos.push([id, o.rodadaId]); return res(id, null) }, base)
    expect(p.tentativas).toBe(9)
    expect(p.disjuntor).toBe(false)
    for (const a of alvos(3)) expect(new Set(vistos.filter(v => v[0] === a.ytId).map(v => v[1])).size).toBe(1)
    expect(new Set(vistos.map(v => v[1])).size).toBe(3)
  })
  it('concorrência 3: nunca mais de 3 leituras em voo', async () => {
    let voo = 0, max = 0
    const ler = async (id: string): Promise<ResultadoLeitor> => { voo++; max = Math.max(max, voo); await new Promise(r => setTimeout(r, 2)); voo--; return res(id, null) }
    await lerPassadas(alvos(8), ler, base)
    expect(max).toBe(3)
  })
  it('passada nova não começa depois de ateMs', async () => {
    let agora = AGORA
    const ler = async (id: string): Promise<ResultadoLeitor> => { agora += 15_000; return res(id, null) }
    const p = await lerPassadas(alvos(1), ler, { ...base, agora: () => agora, ateMs: AGORA + 20_000 })
    expect(p.tentativas).toBe(2)
  })
  it('disjuntor na 2ª passada: alvos com 1 leitura não levam proxima_rodada_em', async () => {
    const chamadas: string[] = []
    const ler = async (id: string, o: OpcoesLeitor): Promise<ResultadoLeitor> => { chamadas.push(o.rodadaId); return res(id, chamadas.length <= 3 ? null : 'http_429') }
    const p = await lerPassadas(alvos(3), ler, base)
    expect(p.disjuntor).toBe(true)
    for (const rs of p.resultados.values()) expect(rs.length).toBeLessThan(3)
    expect(atualizacoesDosAlvos(alvos(3), p, AGORA, () => 0.5)).toEqual([])
  })
})

describe('A8 sonda de miniatura por alvo', () => {
  it('passada 1 leva true; se a 1ª leu, as passadas 2 e 3 levam false', async () => {
    const sondas: boolean[] = []
    await lerPassadas([alvo(1)], async (id, o) => { sondas.push(o.sondarMiniatura === true); return res(id, null) }, base)
    expect(sondas).toEqual([true, false, false])
  })
  it('se a 1ª deu 429, a 2ª leva true', async () => {
    const sondas: boolean[] = []
    let n = 0
    await lerPassadas([alvo(1)], async (id, o) => { sondas.push(o.sondarMiniatura === true); return res(id, ++n === 1 ? 'http_429' : null) }, base)
    expect(sondas).toEqual([true, true, false])
  })
})

describe('A8 estadoDoDisparo', () => {
  it('16 tentativas de sem_initial_data em 3+ vídeos: leitura_bloqueada, feitas 0', () => {
    const p = passadas(4, 4, 'sem_initial_data')
    expect(estadoDoDisparo(p, extra)).toMatchObject({ estado: 'erro', motivo: 'leitura_bloqueada', feitas: 0 })
  })
  it('só 2 vídeos não bastam para leitura_bloqueada', () => {
    expect(estadoDoDisparo(passadas(2, 8, 'sem_initial_data'), extra).motivo).toBeUndefined()
  })
  it('2 vídeos indisponivel: não é leitura_bloqueada (fora do numerador e do denominador)', () => {
    const p = passadas(2, 3, 'indisponivel')
    expect(estadoDoDisparo(p, extra)).toMatchObject({ estado: 'ok' })
    const mista = passadas(3, 3, 'indisponivel')
    mista.resultados.set(9, [res(yt(9), null), res(yt(9), null), res(yt(9), null)])
    expect(estadoDoDisparo(mista, extra).motivo).toBeUndefined()
  })
  it('12 leituras sem renderers: layout_mudou', () => {
    expect(estadoDoDisparo(passadas(4, 3, null, false), extra)).toMatchObject({ estado: 'erro', motivo: 'layout_mudou', feitas: 0 })
  })
  it('alvos_ativos 0 com candidatos 3: parcial sem_alvos; candidatos 0 e alvos 0: ok feitas 0', () => {
    const vazio: Passadas = { resultados: new Map(), disjuntor: false, tentativas: 0 }
    expect(estadoDoDisparo(vazio, { ...extra, alvosAtivos: 0, candidatosEsperados: 3 })).toMatchObject({ estado: 'parcial', motivo: 'sem_alvos' })
    expect(estadoDoDisparo(vazio, { ...extra, alvosAtivos: 0, candidatosEsperados: 0 })).toMatchObject({ estado: 'ok', feitas: 0 })
  })
  it('ordem dos motivos: bloqueado > gravacao_falhou > leitura_bloqueada > layout > sem_alvos > extensao > sobrou', () => {
    const ruim = passadas(4, 4, 'sem_initial_data')
    expect(estadoDoDisparo({ ...ruim, disjuntor: true }, { ...extra, gravou: false }).motivo).toBe('bloqueado')
    expect(estadoDoDisparo(ruim, { ...extra, gravou: false }).motivo).toBe('gravacao_falhou')
    const boa = passadas(2, 3, null)
    expect(estadoDoDisparo(boa, { ...extra, alvosAtivos: 0, extensaoFalhou: 1, sobraram: 2 }).motivo).toBe('sem_alvos')
    expect(estadoDoDisparo(boa, { ...extra, extensaoFalhou: 1, sobraram: 2 }).motivo).toBe('extensao_falhou')
    expect(estadoDoDisparo(boa, { ...extra, sobraram: 2 })).toMatchObject({ estado: 'parcial', motivo: 'sobrou', deixadas: 2 })
    expect(estadoDoDisparo(boa, extra)).toMatchObject({ estado: 'ok', feitas: 6 })
  })
  it('detalhe leva só números', () => {
    const d = estadoDoDisparo(passadas(2, 3, null), { ...extra, devidos: 2, inicioMs: 4000 }).detalhe
    expect(Object.keys(d ?? {}).sort()).toEqual(['alvos_ativos', 'candidatos_esperados', 'com_erro', 'devidos', 'fora_do_formato', 'inicio_ms', 'jogador_bloqueado', 'lidas', 'sem_titulo', 'sobraram'])
    for (const v of Object.values(d ?? {})) expect(typeof v).toBe('number')
  })
})

describe('A8 atualizacoesDosAlvos e indisponivel', () => {
  const fecha = (a: AlvoAtivo, erro: string | null): Passadas => ({ resultados: new Map([[a.id, [res(a.ytId, erro), res(a.ytId, erro), res(a.ytId, erro)]]]), disjuntor: false, tentativas: 3 })
  it('3 leituras: fecha a rodada', () => {
    const a = alvo(1)
    const [u] = atualizacoesDosAlvos([a], fecha(a, null), AGORA, () => 0.5)
    expect(u).toMatchObject({ id: 1, rodadas_mais: 1, ultima_rodada_em: new Date(AGORA).toISOString() })
    expect(Date.parse(u!.proxima_rodada_em ?? '')).toBeGreaterThan(AGORA)
    expect(u!.saiu_em).toBeUndefined()
  })
  it('1 ou 2 leituras: nada no payload (continua devido)', () => {
    const a = alvo(1)
    const p: Passadas = { resultados: new Map([[1, [res(a.ytId, null), res(a.ytId, null)]]]), disjuntor: false, tentativas: 2 }
    expect(atualizacoesDosAlvos([a], p, AGORA, () => 0.5)).toEqual([])
  })
  it('4 rodadas indisponivel sem teste: sai por indisponivel', () => {
    const a = alvo(1, { indisponivelSeguidas: 3 })
    const [u] = atualizacoesDosAlvos([a], fecha(a, 'indisponivel'), AGORA, () => 0.5)
    expect(u).toMatchObject({ indisponivel_seguidas: 4, saiu_por: 'indisponivel', saiu_em: new Date(AGORA).toISOString() })
  })
  it('com teste nosso não sai, mas o contador sobe', () => {
    const a = alvo(1, { indisponivelSeguidas: 3, temTesteNosso: true })
    const [u] = atualizacoesDosAlvos([a], fecha(a, 'indisponivel'), AGORA, () => 0.5)
    expect(u).toMatchObject({ indisponivel_seguidas: 4 })
    expect(u!.saiu_em).toBeUndefined()
    expect(u!.saiu_por).toBeUndefined()
  })
  it('alvo janela_propria ou extensao com teste vivo e 4 indisponivel não sai (Phil I7)', () => {
    for (const motivoAte of ['janela_propria', 'extensao']) {
      const a = alvo(1, { indisponivelSeguidas: 3, temTesteNosso: true, motivoAte })
      const [u] = atualizacoesDosAlvos([a], fecha(a, 'indisponivel'), AGORA, () => 0.5)
      expect(u!.saiu_em, motivoAte).toBeUndefined()
    }
  })
  it('lê título: o contador volta a 0; erro misto não mexe', () => {
    const a = alvo(1, { indisponivelSeguidas: 2 })
    expect(atualizacoesDosAlvos([a], fecha(a, null), AGORA, () => 0.5)[0]!.indisponivel_seguidas).toBe(0)
    expect(atualizacoesDosAlvos([a], fecha(a, 'timeout'), AGORA, () => 0.5)[0]!.indisponivel_seguidas).toBeUndefined()
  })
})
