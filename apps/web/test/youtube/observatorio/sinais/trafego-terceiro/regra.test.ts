// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ORIGEM_LOTE, ORIGEM_SUGERIDOS } from '@/lib/youtube/reporting/codigos'
import {
  estadoDoPar,
  estadoDaSugestao,
  REGRA_F4,
  type EstadoDoPar,
} from '@/lib/youtube/observatorio/sinais/trafego-terceiro/regra'

const HOJE = '2026-10-29'
const base = {
  pubDoTerceiro: '2026-10-01',
  hoje: HOJE,
  intervalos: [{ de: '2026-09-08', ate: '2026-10-27' }],
  linhas: [] as { dia: string; views: number | null }[],
  diasSemOrigem: [] as string[],
}

describe('ORIGEM_SUGERIDOS', () => {
  it('é o 7, par RELATED_VIDEO', () => {
    expect(ORIGEM_SUGERIDOS).toBe('7')
    expect(ORIGEM_LOTE[ORIGEM_SUGERIDOS]?.nome).toBe('RELATED_VIDEO')
  })
  it('regra versionada', () => {
    expect(REGRA_F4).toEqual({ versao: 1, diasMinimosCobertos: 7, atrasoMaxDias: 4, janelaMaxDias: 90 })
  })
})

describe('estadoDoPar', () => {
  it('sim com linha do terceiro', () => {
    expect(estadoDoPar({ ...base, linhas: [{ dia: '2026-10-05', views: 12 }] })).toEqual({ estado: 'sim', views: 12, dias: 1 })
  })
  it('sim com views 0 e com views null', () => {
    expect(estadoDoPar({ ...base, linhas: [{ dia: '2026-10-05', views: 0 }] })).toMatchObject({ estado: 'sim', views: 0 })
    expect(estadoDoPar({ ...base, linhas: [{ dia: '2026-10-05', views: null }] })).toMatchObject({ estado: 'sim', views: null })
  })
  it('nao sem linha, 27 dias cobertos, ate 27/10', () => {
    expect(estadoDoPar(base)).toEqual({ estado: 'nao', diasCobertos: 27, ate: '2026-10-27' })
  })
  it('sem intervalos', () => {
    expect(estadoDoPar({ ...base, intervalos: [] })).toEqual({ estado: 'nao_medido', motivo: 'sem_cobertura' })
  })
  it('ainda_nao_coletado', () => {
    expect(estadoDoPar({ ...base, pubDoTerceiro: '2026-10-28' })).toEqual({ estado: 'nao_medido', motivo: 'ainda_nao_coletado' })
  })
  it('pouca_cobertura (6 dias)', () => {
    expect(estadoDoPar({ ...base, pubDoTerceiro: '2026-10-22' })).toEqual({ estado: 'nao_medido', motivo: 'pouca_cobertura' })
  })
  it('cobertura_velha', () => {
    expect(estadoDoPar({ ...base, pubDoTerceiro: '2026-09-19', intervalos: [{ de: '2026-08-01', ate: '2026-10-19' }] })).toEqual({
      estado: 'nao_medido',
      motivo: 'cobertura_velha',
    })
  })
  it('cobertura até hoje-2 ainda dá nao', () => {
    expect(estadoDoPar({ ...base, intervalos: [{ de: '2026-09-08', ate: '2026-10-27' }] })).toMatchObject({ estado: 'nao' })
  })
  it('origem_nao_informada e sim vence no mesmo dia', () => {
    expect(estadoDoPar({ ...base, diasSemOrigem: ['2026-10-10'] })).toEqual({ estado: 'nao_medido', motivo: 'origem_nao_informada' })
    expect(estadoDoPar({ ...base, diasSemOrigem: ['2026-10-10'], linhas: [{ dia: '2026-10-10', views: 3 }] })).toMatchObject({ estado: 'sim' })
  })
  it('dia sem origem fora da janela é ignorado', () => {
    expect(estadoDoPar({ ...base, diasSemOrigem: ['2026-09-30'] })).toMatchObject({ estado: 'nao' })
  })
  it('buraco na cobertura que ainda soma >= 7 dias dá nao', () => {
    const r = estadoDoPar({
      ...base,
      intervalos: [
        { de: '2026-09-08', ate: '2026-10-09' },
        { de: '2026-10-21', ate: '2026-10-27' },
      ],
    })
    expect(r).toEqual({ estado: 'nao', diasCobertos: 9 + 7, ate: '2026-10-27' })
  })
  it('intervalos sobrepostos não contam duas vezes', () => {
    const r = estadoDoPar({
      ...base,
      intervalos: [
        { de: '2026-10-01', ate: '2026-10-20' },
        { de: '2026-10-10', ate: '2026-10-27' },
      ],
    })
    expect(r).toMatchObject({ estado: 'nao', diasCobertos: 27 })
  })
  it('linha anterior à publicação é ignorada', () => {
    expect(estadoDoPar({ ...base, linhas: [{ dia: '2026-09-30', views: 5 }] })).toMatchObject({ estado: 'nao' })
  })
  it('janela corta em 90 dias', () => {
    const r = estadoDoPar({ ...base, pubDoTerceiro: '2025-01-01', intervalos: [{ de: '2025-01-01', ate: '2026-10-27' }] })
    expect(r).toMatchObject({ estado: 'nao', diasCobertos: 90 - 1 }) // 2026-07-31..2026-10-27
  })
})

const sim: EstadoDoPar = { estado: 'sim', views: 10, dias: 2 }
const nao = (ate = '2026-10-27'): EstadoDoPar => ({ estado: 'nao', diasCobertos: 20, ate })
const nm = (motivo: 'sem_cobertura' | 'pouca_cobertura' = 'sem_cobertura'): EstadoDoPar => ({ estado: 'nao_medido', motivo })

describe('estadoDaSugestao', () => {
  it('sim, nao, nao_medido', () => {
    expect(estadoDaSugestao([sim, nao(), nm()], 'T', null, 3, false)).toMatchObject({
      estado: 'sim',
      videos_com_trafego: 1,
      videos_medidos: 2,
      videos_total: 3,
      views: 10,
      terceiro_video_id: 'T',
      regra: 'f4-trafego-v1',
    })
  })
  it('nao + nao_medido => nao_medido', () => {
    expect(estadoDaSugestao([nao(), nm()], 'T', null, 2, false)).toMatchObject({ estado: 'nao_medido', motivo: 'sem_cobertura' })
  })
  it('contexto (desde, coberto_ate) vai também no nao_medido; sem contexto, nulos', () => {
    expect(estadoDaSugestao([nm()], 'T', null, 1, false, { desde: '2026-10-01', coberto_ate: '2026-10-20' })).toMatchObject({ estado: 'nao_medido', desde: '2026-10-01', coberto_ate: '2026-10-20' })
    expect(estadoDaSugestao([nm()], 'T', null, 1, false)).toMatchObject({ desde: null, coberto_ate: null })
  })

  it('nao + nao => nao com menor ate', () => {
    expect(estadoDaSugestao([nao('2026-10-27'), nao('2026-10-25')], 'T', null, 2, false)).toMatchObject({
      estado: 'nao',
      motivo: null,
      ate: '2026-10-25',
      videos_medidos: 2,
    })
  })
  it('truncada sem sim => lista_truncada', () => {
    expect(estadoDaSugestao([nao(), nao()], 'T', null, 21, true)).toMatchObject({ estado: 'nao_medido', motivo: 'lista_truncada' })
  })
  it('truncada com sim continua sim', () => {
    expect(estadoDaSugestao([sim, nao()], 'T', null, 21, true).estado).toBe('sim')
  })
  it('vazio => nao_se_aplica', () => {
    expect(estadoDaSugestao([], null, null, 0, false)).toMatchObject({ estado: 'nao_se_aplica', motivo: null, views: null })
  })
  it('motivo geral vence os pares', () => {
    expect(estadoDaSugestao([sim, nao()], 'T', 'sem_direito', 2, false)).toMatchObject({ estado: 'nao_medido', motivo: 'sem_direito' })
    expect(estadoDaSugestao([], null, 'sem_direito', 0, false)).toMatchObject({ estado: 'nao_medido', motivo: 'sem_direito' })
  })
  it('motivo mais frequente, desempate pela ordem do tipo', () => {
    expect(estadoDaSugestao([nm('pouca_cobertura'), nm('sem_cobertura'), nm('pouca_cobertura')], 'T', null, 3, false).motivo).toBe('pouca_cobertura')
    expect(estadoDaSugestao([nm('pouca_cobertura'), nm('sem_cobertura')], 'T', null, 2, false).motivo).toBe('sem_cobertura')
  })
  it('views nulo se algum sim tem views nulo; soma caso contrário', () => {
    expect(estadoDaSugestao([sim, { estado: 'sim', views: null, dias: 1 }], 'T', null, 2, false).views).toBeNull()
    expect(estadoDaSugestao([sim, { estado: 'sim', views: 5, dias: 1 }], 'T', null, 2, false).views).toBe(15)
  })
})
