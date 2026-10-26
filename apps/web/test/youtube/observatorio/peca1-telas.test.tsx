// @vitest-environment node
// Manutenção M5, Tarefa 5: a peça 1 ligada à tela do vídeo (views por idade). Dois lados: com nada saiu a tela é a de hoje, com um mês fora diz "no arquivo".
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { _esquecerAvisos } from '@/lib/youtube/observatorio/arquivo-mensal/online-desde'
import { naoMedido, medido } from '@/lib/youtube/observatorio/medidas/tipos'
import { blocoDeIdade, type EntradaDeIdade } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/idade-model'
import { CurvaPorIdade } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/curva-por-idade'
import { arquivoDoVideo } from '@/app/cms/(authed)/youtube/competitors/_historico/medidas/ler-do-video'

const sp = (d: string) => Date.parse(d + 'T03:00:00Z')
const html = (el: ReactElement): string => renderToStaticMarkup(el)
const IDADES = [1, 2, 3, 5, 7, 14, 21, 30, 60, 90]
const PUB = sp('2026-10-10')
const NOW = sp('2027-06-10')
// as marcas (1, 7, 30) medidas; as outras idades a contagem por dia não alcança (a série começa depois do ponto)
const pontos = IDADES.map((idadeDias) => ({
  idadeDias,
  ponto: [1, 7, 30].includes(idadeDias) ? medido(1000 * idadeDias, 1, { de: null, ate: null, dias: null }) : naoMedido('leitura_comecou_depois'),
}))
const ent: EntradaDeIdade = { hojeSP: '2027-06-10', inicioDaContagem: '2026-10-03', publicadoEm: '2026-10-10', aoVivo: false, saiuDoYoutube: false, horasAteEntrar: 1, pontos, normal: null }
const arq = (o: Partial<NonNullable<EntradaDeIdade['arquivo']>> = {}) => ({ onlineDesde: sp('2027-05-01'), lido: true, coleta: sp('2026-10-03'), baseMs: PUB, agoraMs: NOW, ...o })

beforeEach(() => _esquecerAvisos())

describe('peça 1 na curva por idade', () => {
  it('nada saiu (online desde nulo e lido): o bloco é IDÊNTICO ao de hoje, ponto a ponto', () => {
    expect(blocoDeIdade({ ...ent, arquivo: arq({ onlineDesde: null }) })).toEqual(blocoDeIdade(ent))
    expect(html(<CurvaPorIdade bloco={blocoDeIdade({ ...ent, arquivo: arq({ onlineDesde: null }) })} />)).toBe(html(<CurvaPorIdade bloco={blocoDeIdade(ent)} />))
  })
  it('um mês fora do banco: o ponto diz "dd/mm a dd/mm/aaaa no arquivo", sem número, e as marcas seguem medidas', () => {
    const b = blocoDeIdade({ ...ent, arquivo: arq() })
    if (b.tipo !== 'ok') throw new Error(b.tipo)
    const p14 = b.pontos.find((p) => p.idade === 14)!
    expect(p14.video).toMatchObject({ tipo: 'nao_medido', curto: '01/10 a 30/04/2027 no arquivo', peca1: { forma: 'arquivo' } })
    expect(p14.fala.startsWith('Com 14 dias: 01/10 a 30/04/2027 no arquivo.')).toBe(true)
    expect(p14.fala).not.toContain('não medido: 01/10')
    for (const i of [1, 7, 30]) expect(b.pontos.find((p) => p.idade === i)!.video.tipo).toBe('medido')
  })
  it('a tela desenha a caixa de arquivo e o trecho com o rótulo, e a legenda ganha "no arquivo"', () => {
    const s = html(<CurvaPorIdade bloco={blocoDeIdade({ ...ent, arquivo: arq() })} />)
    expect(s).toContain('obs-ea-ponto')
    expect(s).toContain('obs-ea-trecho')
    expect(s).toContain('no arquivo')
  })
  it('sem a peça 1 a tela não tem nenhuma forma de arquivo', () => {
    const s = html(<CurvaPorIdade bloco={blocoDeIdade(ent)} />)
    expect(s).not.toContain('obs-ea-')
    expect(s).not.toContain('no arquivo')
  })
  it('online desde não lido: só o ponto antes do início seguro vira "não foi possível ler"; o recente fica como hoje', () => {
    const b = blocoDeIdade({ ...ent, arquivo: arq({ onlineDesde: null, lido: false }) })
    if (b.tipo !== 'ok') throw new Error(b.tipo)
    const hoje = blocoDeIdade(ent)
    if (hoje.tipo !== 'ok') throw new Error(hoje.tipo)
    expect(b.pontos.find((p) => p.idade === 14)!.video).toMatchObject({ curto: 'Não foi possível ler desde quando há dado online.', peca1: { forma: 'hachura' } })
    // 90 dias: 08/01/2027 está dentro dos 181 dias garantidos: continua o texto de hoje
    expect(b.pontos.find((p) => p.idade === 90)!.video).toEqual(hoje.pontos.find((p) => p.idade === 90)!.video)
  })
  it('antes da coleta do vídeo: o texto de hoje fica (não vira "no arquivo")', () => {
    const b = blocoDeIdade({ ...ent, arquivo: arq({ coleta: sp('2027-03-15') }) })
    const hoje = blocoDeIdade(ent)
    if (b.tipo !== 'ok' || hoje.tipo !== 'ok') throw new Error('bloco')
    expect(b.pontos.find((p) => p.idade === 14)!.video).toEqual(hoje.pontos.find((p) => p.idade === 14)!.video)
  })
})

describe('arquivoDoVideo (a coleta é a DESTE vídeo)', () => {
  const canal = (added: number | null) => (id: string) => (id === 'c1' ? { id, name: 'c', own: false, sync: { added } } : undefined)
  it('sem ONLINE_DESDE no Observatório: nada (a tela de hoje)', () => {
    expect(arquivoDoVideo({ channel: canal(null), SERIES_START: sp('2026-10-03') }, 'c1')).toEqual({})
  })
  it('lido: o online desde da série por dia e a coleta pelo maior entre a série e o canal adicionado', () => {
    const od = { lido: true as const, porTabela: { competitor_video_daily: sp('2027-05-01'), competitor_video_early: null, competitor_video_hourly: null } }
    expect(arquivoDoVideo({ channel: canal(sp('2027-03-15') + 5 * 3_600_000), SERIES_START: sp('2026-10-03'), ONLINE_DESDE: od }, 'c1'))
      .toEqual({ arquivo: { lido: true, onlineDesde: sp('2027-05-01'), coleta: sp('2027-03-15') } })
    expect(arquivoDoVideo({ channel: canal(null), SERIES_START: sp('2026-10-03'), ONLINE_DESDE: od }, 'c1').arquivo?.coleta).toBe(sp('2026-10-03'))
  })
  it('não lido: lido falso e sem data', () => {
    expect(arquivoDoVideo({ channel: canal(null), SERIES_START: sp('2026-10-03'), ONLINE_DESDE: { lido: false, porque: 'erro_do_banco' } }, 'c1'))
      .toEqual({ arquivo: { lido: false, onlineDesde: null, coleta: sp('2026-10-03') } })
  })
})
