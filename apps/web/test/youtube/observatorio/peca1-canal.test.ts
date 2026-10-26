// @vitest-environment node
/** Manutenção M5, T5c (04 §14.1, itens 36, 84 e 85): a peça 1 nos leitores fora das telas de série do vídeo. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }))
import { _esquecerAvisos } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'
import { IDADES_DE_MARCA } from '@/lib/youtube/observatorio/arquivo-mensal/peca1'
import { naoMedido, medido } from '@/lib/youtube/observatorio/medidas/tipos'
import { blocoDeIdade, type EntradaDeIdade } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/idade-model'
import { idadeIa } from '@/app/cms/(authed)/youtube/competitors/_contexto-ia/empacotar-video-medidas'
import { IDADES } from '@/app/cms/(authed)/youtube/competitors/_outliers/idade-model'

const sp = (d: string): number => Date.parse(d + 'T03:00:00Z')
const PUB = sp('2026-10-10'), NOW = sp('2027-06-10')
const IDADES_VIDEO = [1, 2, 3, 5, 7, 14, 21, 30, 60, 90]
const pontos = IDADES_VIDEO.map((idadeDias) => ({
  idadeDias,
  ponto: [1, 7, 30].includes(idadeDias) ? medido(1000 * idadeDias, 1, { de: null, ate: null, dias: null }) : naoMedido('leitura_comecou_depois'),
}))
const ent: EntradaDeIdade = { hojeSP: '2027-06-10', inicioDaContagem: '2026-10-03', publicadoEm: '2026-10-10', aoVivo: false, saiuDoYoutube: false, horasAteEntrar: 1, pontos, normal: null }
const arq = (o: Partial<NonNullable<EntradaDeIdade['arquivo']>> = {}) => ({ onlineDesde: sp('2027-05-01'), lido: true, coleta: sp('2026-10-03'), baseMs: PUB, agoraMs: NOW, ...o })

beforeEach(() => _esquecerAvisos())

describe('pacote da IA (views por idade do vídeo)', () => {
  it('nada saiu (online desde nulo e lido): o pacote é IDÊNTICO ao de hoje', () => {
    const b = blocoDeIdade({ ...ent, arquivo: arq({ onlineDesde: null }) })
    expect(idadeIa(b)).toEqual(idadeIa(blocoDeIdade(ent)))
  })
  it('um mês fora do banco: o pacote diz o trecho no arquivo e não traz número naquela idade', () => {
    const i = idadeIa(blocoDeIdade({ ...ent, arquivo: arq() }))
    const p14 = i.pontos.find((p) => p.rotulo.includes('14'))!
    expect(p14.video).toBeNull()
    expect(p14.videoMotivo).toBe('01/10 a 30/04/2027 no arquivo')
    // as marcas (1, 7 e 30 dias) seguem com número
    expect(i.pontos.filter((p) => p.video !== null)).toHaveLength(3)
  })
  it('online desde não lido: o pacote diz que não foi possível ler, nunca "no arquivo"', () => {
    const i = idadeIa(blocoDeIdade({ ...ent, arquivo: arq({ lido: false, onlineDesde: null }) }))
    const ms = i.pontos.map((p) => p.videoMotivo ?? '')
    expect(ms.some((m) => m.includes('Não foi possível ler desde quando há dado online.'))).toBe(true)
    expect(ms.some((m) => m.includes('no arquivo'))).toBe(false)
  })
})

describe('outliers: views aos 7 e 30 dias', () => {
  it('as duas idades são marcas (competitor_video_marks): nunca ficam "no arquivo", então a tela não muda', () => {
    for (const i of IDADES) expect(IDADES_DE_MARCA).toContain(i)
  })
})
