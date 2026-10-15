// @vitest-environment node
// E5b T17: as entradas puras da aba Origem (17b) e dos cartões da aba Retenção (17a) do canal próprio. Nada aqui lê banco.
import { describe, it, expect } from 'vitest'
import { buildAssistidoDoCanal, janelaDaOrigemDoCanal, periodosDaOrigemDoCanal, publicacaoMaisAntiga } from '@/app/cms/(authed)/youtube/competitors/_proprio/view-model'
import { dayPt } from '@/lib/youtube/coleta/day-pt'
import type { DiarioDoPeriodo } from '@/lib/youtube/observatorio/proprio/diario-periodo'

const ATE = '2026-10-11'
const diarioVazio = (conhecida: boolean, ate = ATE): DiarioDoPeriodo => ({ canalId: 'c', de: '2026-07-14', ate, linhas: [], foraDoTeto: [], descartados: 0, cobertura: { conhecida, videosCompletos: 0, videosIncompletos: 0, primeiroDiaLido: null, intervalos: new Map(), ytIds: [], publicacoes: new Map() } })

describe('janelaDaOrigemDoCanal', () => {
  it('90 dias de diário; "Desde {ano}" amplia a janela até a publicação mais antiga sem passar do começo da coleta; sem data, só 90 dias', () => {
    expect(janelaDaOrigemDoCanal({ ate: ATE, maisAntiga: null, ligadoEm: '2026-10-04' })).toEqual({ de: '2026-07-14', diarioDesde: '2026-07-14' })
    expect(janelaDaOrigemDoCanal({ ate: ATE, maisAntiga: '2015-04-08', ligadoEm: '2026-10-04' })).toEqual({ de: '2026-07-14', diarioDesde: '2026-07-14' })
    expect(janelaDaOrigemDoCanal({ ate: ATE, maisAntiga: '2015-04-08', ligadoEm: '2026-05-01' })).toEqual({ de: '2026-05-01', diarioDesde: '2026-07-14' })
    expect(janelaDaOrigemDoCanal({ ate: ATE, maisAntiga: '2026-06-01', ligadoEm: '2026-05-01' })).toEqual({ de: '2026-06-01', diarioDesde: '2026-07-14' })
    expect(janelaDaOrigemDoCanal({ ate: ATE, maisAntiga: '2026-09-30', ligadoEm: '2026-05-01' })).toEqual({ de: '2026-07-14', diarioDesde: '2026-07-14' })
  })
})

describe('publicacaoMaisAntiga', () => {
  const obs = { videos: [{ ch: 'a', pub: Date.UTC(2020, 2, 5, 15) }, { ch: 'a', pub: Date.UTC(2019, 0, 9, 15) }, { ch: 'b', pub: Date.UTC(2010, 0, 1, 15) }, { ch: 'a', pub: null }] }
  it('a mais antiga do canal, ignorando os de outro canal e os sem data; nula quando nenhum tem data', () => {
    expect(publicacaoMaisAntiga(obs, 'a', ms => dayPt(new Date(ms)))).toBe('2019-01-09')
    expect(publicacaoMaisAntiga(obs, 'zzz', ms => dayPt(new Date(ms)))).toBeNull()
    expect(publicacaoMaisAntiga({ videos: [{ ch: 'a', pub: null }] }, 'a', ms => dayPt(new Date(ms)))).toBeNull()
  })
})

describe('periodosDaOrigemDoCanal', () => {
  it('7, 28, 90 e "Desde {ano}" (o ano do vídeo mais antigo), nessa ordem, com o intervalo de cada um terminando no último dia', () => {
    const p = periodosDaOrigemDoCanal({ ate: ATE, maisAntiga: '2015-04-08', diario: diarioVazio(true), diarioInteiro: diarioVazio(true) })
    expect(p.map(x => [x.id, x.rotulo, x.de, x.ate])).toEqual([
      ['7', '7 dias', '2026-10-05', ATE], ['28', '28 dias', '2026-09-14', ATE], ['90', '90 dias', '2026-07-14', ATE], ['tudo', 'Desde 2015', '2015-04-08', ATE],
    ])
  })
  it('canal sem vídeo com data: o período longo não é oferecido', () => {
    expect(periodosDaOrigemDoCanal({ ate: ATE, maisAntiga: null, diario: diarioVazio(true), diarioInteiro: null }).map(x => x.id)).toEqual(['7', '28', '90'])
  })
  it('diário inteiro ausente (teto ou erro): o total longo é nulo sem derrubar os três curtos; cobertura desconhecida: nenhum total é afirmado', () => {
    const p = periodosDaOrigemDoCanal({ ate: ATE, maisAntiga: '2015-04-08', diario: diarioVazio(true), diarioInteiro: null })
    expect(p.find(x => x.id === 'tudo')).toMatchObject({ totalDoPeriodo: null, videosDoTotal: null })
    expect(p.find(x => x.id === '7')!.videosDoTotal).not.toBeNull()
    const d = periodosDaOrigemDoCanal({ ate: ATE, maisAntiga: '2015-04-08', diario: diarioVazio(false), diarioInteiro: diarioVazio(false) })
    expect(d.every(x => x.totalDoPeriodo === null)).toBe(true)
  })
  it('sem diário (origem negada ou em erro): quatro períodos sem total', () => {
    const p = periodosDaOrigemDoCanal({ ate: ATE, maisAntiga: '2015-04-08', diario: null, diarioInteiro: null })
    expect(p).toHaveLength(4); expect(p.every(x => x.totalDoPeriodo === null && x.videosDoTotal === null)).toBe(true)
  })
})

describe('buildAssistidoDoCanal', () => {
  const diario = { canalId: 'c', linhas: [], relatorios: [], ultimoDia: null, foraDoTeto: 0, descartados: 0 } as never
  it('sem diário no canal (longo nulo): os três cartões dizem que a coleta não rodou, nunca zero', () => {
    const v = buildAssistidoDoCanal({ ytIds: [], videos: [], diario, longo: null })
    expect(v.estado).toBe('ok')
    expect(JSON.stringify(v)).toMatch(/coleta diária ainda não rodou/)
  })
  it('leitura negada ou com erro: o estado do bloco diz qual', () => {
    expect(buildAssistidoDoCanal({ ytIds: [], videos: [], diario, longo: { acesso: 'negado' } }).estado).toBe('negado')
    expect(buildAssistidoDoCanal({ ytIds: [], videos: [], diario, longo: { acesso: 'erro' } }).estado).toBe('erro')
  })
})
