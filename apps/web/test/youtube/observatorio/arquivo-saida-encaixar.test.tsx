// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import type { ModeloPagina, LinhaDoMes } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'

vi.mock('server-only', () => ({}))
vi.mock('@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes', () => ({ simularSaida: vi.fn(), tirarMes: vi.fn(), liberarEspaco: vi.fn(), trazerDeVolta: vi.fn() }))
import { encaixarSaida } from '@/app/cms/(authed)/youtube/competitors/_arquivo-saida/encaixar'
import * as acoesMock from '@/app/cms/(authed)/youtube/competitors/_arquivo-saida/acoes'

const linha = (tabela: string, mes: string, fora: 'online' | 'destacado' | 'descartado', extra: Partial<LinhaDoMes> = {}): LinhaDoMes =>
  ({ chave: `${tabela}|${mes}`, tabela, mes, fora, mesNome: mes, regua: [], frase: 'x', secundaria: null, gravidade: 'nenhuma', sobeAoTopo: false, ...extra })
const mes12 = (tabela: string): LinhaDoMes[] => Array.from({ length: 12 }, (_, i) => linha(tabela, `2027-${String(i + 1).padStart(2, '0')}-01`, 'online'))
const modelo = (extra: LinhaDoMes[] = []): ModeloPagina => ({ hojeSP: '2028-05-02', resumo: { texto: 'r', forma: 'visto' }, casa: { estado: 'responde', desde: null, forma: 'visto', frase: '' }, problemas: [], mesesAFrente: [], teste: null, ligado: true,
  tipos: [{ tipo: 'serie', titulo: 'Views por dia', resumo: '', anosNoArquivo: [], linhas: [...mes12('competitor_video_daily'), ...extra] }, { tipo: 'horaria', titulo: 'Hora em hora', resumo: '', anosNoArquivo: [], linhas: mes12('competitor_video_hourly') }] })
function sb() {
  const rpc = vi.fn(async (fn: string) => fn === 'obs_archive_exit_check'
    ? { data: { estado: 'online', faltam: [], descartes: 0, dois_passos: true }, error: null }
    : { data: { descartes: 1, simulacoes: 0 }, error: null })
  return { rpc, client: { rpc } as never }
}
type PropsDaPeca = { estado: unknown; ehAdmin: boolean; acoes: Record<string, unknown>; esperaDias: number | null; contado: unknown; tabela: string; mes: string }
const propsDe = (l: LinhaDoMes): PropsDaPeca => (l.acoes as { props: PropsDaPeca }).props

describe('encaixarSaida (D-M5-14)', () => {
  it('12 meses por tabela: só o mais antigo online ganha a peça 3; chamadas = T + destacados + 2', async () => {
    const { rpc, client } = sb()
    const out = await encaixarSaida(modelo(), { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(out.tipos[0]!.linhas.filter(l => l.acoes).map(l => l.mes)).toEqual(['2027-01-01'])
    expect(rpc).toHaveBeenCalledTimes(2 + 0 + 2)
  })
  it('com 24 meses por tabela e 1 destacado a conta segue a regra, sem passar de T + destacados + 2', async () => {
    const { rpc, client } = sb()
    const m = modelo(); m.tipos[0]!.linhas = [linha('competitor_video_daily', '2026-12-01', 'destacado'), ...m.tipos[0]!.linhas, ...mes12('competitor_video_daily').map(l => ({ ...l, mes: l.mes!.replace('2027', '2028'), chave: l.chave + 'b' }))]
    await encaixarSaida(m, { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(rpc.mock.calls.length).toBeLessThanOrEqual(2 + 1 + 2)
  })
  it('leitura nula: a peça recebe estado null; quem não administra não recebe ação (ehAdmin false)', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'x' } }))
    const out = await encaixarSaida(modelo(), { sb: { rpc } as never, site: 's', por: 'u', ehAdmin: false })
    const p = propsDe(out.tipos[0]!.linhas[0]!)
    expect(p.estado).toBeNull(); expect(p.ehAdmin).toBe(false)
  })
  it('a ação certa vai para a peça certa: as quatro funções do servidor, cada uma na sua chave', async () => {
    const { client } = sb()
    const out = await encaixarSaida(modelo(), { sb: client, site: 's', por: 'u', ehAdmin: true })
    const a = propsDe(out.tipos[0]!.linhas[0]!).acoes
    expect(a.simular).toBe(acoesMock.simularSaida); expect(a.tirar).toBe(acoesMock.tirarMes)
    expect(a.liberar).toBe(acoesMock.liberarEspaco); expect(a.trazer).toBe(acoesMock.trazerDeVolta)
    expect(propsDe(out.tipos[1]!.linhas[0]!).tabela).toBe('competitor_video_hourly')
  })
  it('a espera da política vem da linha (nunca constante) e a contagem sem dado é nula, não 0', async () => {
    const { client } = sb()
    const m = modelo(); m.tipos[0]!.linhas[0] = { ...m.tipos[0]!.linhas[0]!, esperaDias: 9 }
    const out = await encaixarSaida(m, { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(propsDe(out.tipos[0]!.linhas[0]!).esperaDias).toBe(9)
    expect(propsDe(out.tipos[0]!.linhas[0]!).contado).toBeNull()
    expect(propsDe(out.tipos[1]!.linhas[0]!).esperaDias).toBeNull()
  })
  it('a frase da linha destacada da M5 fica; o encaixe só acrescenta o bloco de ação', async () => {
    const { client } = sb()
    const m = modelo(); m.tipos[0]!.linhas[0] = { ...m.tipos[0]!.linhas[0]!, fora: 'destacado', frase: 'FRASE DA M5' }
    const out = await encaixarSaida(m, { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(out.tipos[0]!.linhas[0]!.frase).toBe('FRASE DA M5'); expect(out.tipos[0]!.linhas[0]!.acoes).toBeTruthy()
  })
  it('mês descartado e linha sem tabela/mes (M5 antiga) não ganham ação; modelo sem hojeSP volta igual', async () => {
    const { rpc, client } = sb()
    const m = modelo([linha('competitor_video_daily', '2026-01-01', 'descartado'), { chave: 'x', mesNome: 'x', regua: [], frase: 'x', secundaria: null, gravidade: 'nenhuma', sobeAoTopo: false }])
    const out = await encaixarSaida(m, { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(out.tipos[0]!.linhas.filter(l => l.acoes).length).toBe(1)
    const sem = { ...modelo(), hojeSP: undefined }
    expect(await encaixarSaida(sem, { sb: client, site: 's', por: 'u', ehAdmin: true })).toBe(sem)
    expect(rpc).toHaveBeenCalledTimes(4)   // só a primeira chamada leu
  })
  it('grupo de teste: a tabela do ensaio entra com o mês online mais antigo', async () => {
    const { client } = sb()
    const m = modelo(); m.teste = { faixa: 'f', encerradoEm: null, linhas: [linha('obs_archive_rehearsal', '2027-02-01', 'online'), linha('obs_archive_rehearsal', '2027-01-01', 'online')] }
    const out = await encaixarSaida(m, { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(out.teste!.linhas.map(l => !!l.acoes)).toEqual([false, true])
  })
  it('não muta o modelo da M5', async () => {
    const { client } = sb(); const m = modelo()
    await encaixarSaida(m, { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(m.tipos[0]!.linhas.every(l => l.acoes === undefined)).toBe(true); expect(m.tipos[0]!.acoes).toBeUndefined()
  })
})

describe('encaixarSaida: série por tabela (Phil C1 / Yannis I-1, decisão do dono: um bloco por tabela)', () => {
  const D = 'competitor_video_daily', E = 'competitor_video_early'
  const serie = (mesNum: number, d: 'online' | 'destacado' | 'descartado', e: 'online' | 'destacado' | 'descartado'): LinhaDoMes =>
    linha(D, `2027-${String(mesNum).padStart(2, '0')}-01`, d === e ? d : 'online', { chave: `serie:${mesNum}`, saidas: [{ tabela: D, fora: d }, { tabela: E, fora: e }] })
  const modeloSerie = (linhas: LinhaDoMes[]): ModeloPagina => ({ hojeSP: '2028-05-02', resumo: { texto: 'r', forma: 'visto' }, casa: { estado: 'responde', desde: null, forma: 'visto', frase: '' }, problemas: [], mesesAFrente: [], teste: null, ligado: true,
    tipos: [{ tipo: 'serie', titulo: 'Views por dia', resumo: '', anosNoArquivo: [], linhas }] })
  const blocos = (l: LinhaDoMes): { tabela: string; mes: string }[] => {
    const achar = (n: unknown): { tabela: string; mes: string }[] => {
      if (Array.isArray(n)) return n.flatMap(achar)
      if (!n || typeof n !== 'object') return []
      const pr = (n as { props?: { tabela?: string; mes?: string; children?: unknown } }).props
      if (!pr) return []
      return pr.tabela ? [{ tabela: pr.tabela, mes: pr.mes! }] : achar(pr.children)
    }
    return achar(l.acoes)
  }
  it('(a) M com diária descartada e early online; M+1 online nas duas: early de M tem botão, diária de M+1 tem botão, diária de M não tem', async () => {
    const { client } = sb()
    const out = await encaixarSaida(modeloSerie([serie(1, 'descartado', 'online'), serie(2, 'online', 'online')]), { sb: client, site: 's', por: 'u', ehAdmin: true })
    const [m, m1] = out.tipos[0]!.linhas
    expect(blocos(m!)).toEqual([{ tabela: E, mes: '2027-01-01' }])
    expect(blocos(m1!)).toEqual([{ tabela: D, mes: '2027-02-01' }])
  })
  it('(b) M totalmente online: dois blocos na linha M, um por tabela, e o banco é lido para a early', async () => {
    const { rpc, client } = sb()
    const out = await encaixarSaida(modeloSerie([serie(1, 'online', 'online'), serie(2, 'online', 'online')]), { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(blocos(out.tipos[0]!.linhas[0]!)).toEqual([{ tabela: D, mes: '2027-01-01' }, { tabela: E, mes: '2027-01-01' }])
    expect(blocos(out.tipos[0]!.linhas[1]!)).toEqual([])
    expect(rpc.mock.calls.some(c => (c[1] as { p_table?: string }).p_table === E)).toBe(true)
  })
  it('(c) chamadas = 3 tabelas + destacados + 2', async () => {
    const { rpc, client } = sb()
    const m = modeloSerie([serie(1, 'destacado', 'online'), serie(2, 'online', 'online')]); m.tipos.push({ tipo: 'horaria', titulo: 'h', resumo: '', anosNoArquivo: [], linhas: mes12('competitor_video_hourly') })
    await encaixarSaida(m, { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(rpc).toHaveBeenCalledTimes(3 + 1 + 2)
  })
  it('tabela destacada mostra o estado dela e a outra, "Tirar"; descartada não vira bloco vazio', async () => {
    const { client } = sb()
    const out = await encaixarSaida(modeloSerie([serie(1, 'destacado', 'online'), serie(2, 'descartado', 'descartado')]), { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(blocos(out.tipos[0]!.linhas[0]!).map(b => b.tabela)).toEqual([D, E])
    expect(out.tipos[0]!.linhas[1]!.acoes).toBeUndefined()
  })
  it('layout r4: na série cada bloco recebe o nome da sua tabela; na horária o bloco não leva cabeçalho', async () => {
    const { client } = sb()
    const out = await encaixarSaida(modeloSerie([serie(1, 'online', 'online')]), { sb: client, site: 's', por: 'u', ehAdmin: true })
    const nomes = ((out.tipos[0]!.linhas[0]!.acoes as { props: { children: { props: { nome?: string } }[] } }).props.children).map(c => c.props.nome)
    expect(nomes).toEqual(['Views por dia', 'Primeiras horas'])
    const h = await encaixarSaida(modelo(), { sb: client, site: 's', por: 'u', ehAdmin: true })
    expect(propsDe(h.tipos[1]!.linhas[0]!)).not.toHaveProperty('nome')
  })
})

import { fraseDosEscondidos } from '@/lib/youtube/observatorio/arquivo-mensal/estado-do-mes'
describe('resumo do cartão da série: simétrico (mockup 19 B r4)', () => {
  const sd = (d: 'online' | 'destacado', e: 'online' | 'destacado') => [{ mes: '2028-02-01', saidas: [{ tabela: 'competitor_video_daily', fora: d }] }, { mes: '2028-01-01', saidas: [{ tabela: 'competitor_video_early', fora: e }] }]
  it('diária fora, early fora, as duas; nenhuma = vazio', () => {
    expect(fraseDosEscondidos(sd('destacado', 'online'))).toBe(' Views por dia: fevereiro de 2028 está escondido das telas e espera o prazo para apagar do banco. Primeiras horas segue online.')
    expect(fraseDosEscondidos(sd('online', 'destacado'))).toBe(' Primeiras horas: janeiro de 2028 está escondido das telas e espera o prazo para apagar do banco. Views por dia segue online.')
    expect(fraseDosEscondidos(sd('destacado', 'destacado'))).toBe(' Os dois estão escondidos das telas e esperam o prazo para apagar do banco: Views por dia (fevereiro de 2028) e Primeiras horas (janeiro de 2028).')
    expect(fraseDosEscondidos(sd('online', 'online'))).toBe('')
  })
})
