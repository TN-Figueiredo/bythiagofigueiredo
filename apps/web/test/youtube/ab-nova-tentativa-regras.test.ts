// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  MAX_TENTATIVAS, JANELA_DO_SIM_MS, proximoDoVigia, proximaDoInterrompido, inicioDoSim, simAindaVale,
  camposPendentes, podeDispensar, erroDeCota, converterInterrompido, paraRestoreStatus,
  type CampoRestauracao,
} from '@/lib/youtube/ab-restore'
import { REASONS_DE_COTA } from '@/lib/youtube/youtube-api-error'
import { HORAS_DO_VIGIA_UTC, ATRASO_DO_VIGIA_MS, proximaVerificacao, vigiaAtrasado } from '@/lib/youtube/ab-vigia-horario'

const T0 = Date.parse('2026-10-20T12:00:00Z')
const h = (n: number) => new Date(T0 - n * 3_600_000).toISOString()
const base: CampoRestauracao = { estado: 'falhou', destino: 'v1', em: h(1), forcado: false, escreveu: false, erro: null, attempts: 1 }
const emAndamento: CampoRestauracao = { ...base, estado: 'em_andamento', escreveu: null, attempts: 1 }
const falhou = base
const desistiuTres: CampoRestauracao = { ...base, estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 }
const cota = (reason: string) => ({ status: 403, reason, chamada: 'videos.update' as const })

describe('constantes', () => {
  it('valores fixos', () => {
    expect(MAX_TENTATIVAS).toBe(3)
    expect(JANELA_DO_SIM_MS).toBe(48 * 3_600_000)
    expect(REASONS_DE_COTA).toEqual(['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'])
  })
  it('erroDeCota', () => {
    expect(erroDeCota(cota('quotaExceeded'))).toBe(true)
    expect(erroDeCota(cota('forbidden'))).toBe(false)
    expect(erroDeCota({ motivo: 'token' })).toBe(false)
    expect(erroDeCota('interrompido')).toBe(false)
    expect(erroDeCota(null)).toBe(false)
  })
})

describe('proximoDoVigia', () => {
  it('attempts 1 e falha que conta → falhou com 2', () => expect(proximoDoVigia(1, { status: 403, reason: 'forbidden', chamada: 'thumbnails.set' })).toEqual({ estado: 'falhou', attempts: 2, motivo: null }))
  it('attempts 2 e falha que conta → desistiu/tres_falhas com 3', () => expect(proximoDoVigia(2, { motivo: 'token' })).toEqual({ estado: 'desistiu', attempts: 3, motivo: 'tres_falhas' }))
  it.each(['quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded'])('cota (%s) não conta', (reason) =>
    expect(proximoDoVigia(2, cota(reason))).toEqual({ estado: 'falhou', attempts: 2, motivo: null }))
  it('interrompido (string) conta', () => expect(proximoDoVigia(1, 'interrompido').attempts).toBe(2))
  it('cota vencida (> 72 h da âncora) conta como falha', () => expect(proximoDoVigia(1, cota('quotaExceeded'), true).attempts).toBe(2))
})

describe('proximaDoInterrompido (F1/Y-1, regressão da P4a)', () => {
  it('attempts 0 → falhou 1', () => expect(proximaDoInterrompido({ ...emAndamento, attempts: 0 })).toMatchObject({ estado: 'falhou', attempts: 1, erro: 'interrompido', escreveu: null }))
  it('attempts 1 → falhou 2', () => expect(proximaDoInterrompido({ ...emAndamento, attempts: 1 })).toMatchObject({ estado: 'falhou', attempts: 2 }))
  it('attempts 2 → desistiu/tres_falhas com 3', () => expect(proximaDoInterrompido({ ...emAndamento, attempts: 2 })).toMatchObject({ estado: 'desistiu', motivo: 'tres_falhas', attempts: 3 }))
  it('mantém o em', () => expect(proximaDoInterrompido(emAndamento).em).toBe(emAndamento.em))
  it('converterInterrompido usa a mesma regra', () => {
    const velho = { ...emAndamento, em: h(1), attempts: 2 }
    expect(converterInterrompido(velho, new Date(T0))).toMatchObject({ estado: 'desistiu', motivo: 'tres_falhas', attempts: 3, erro: 'interrompido' })
  })
})

describe('inicioDoSim (Y-3)', () => {
  it('cadeia forcado de 3 linhas, a primeira há 50 h e a última há 1 h → âncora de 50 h', () => {
    expect(inicioDoSim([{ em: h(1), forcado: true }, { em: h(25), forcado: true }, { em: h(50), forcado: true }])).toBe(h(50))
  })
  it('cadeia quebrada por forcado false → a âncora é a linha depois da quebra', () => {
    expect(inicioDoSim([{ em: h(1), forcado: true }, { em: h(25), forcado: true }, { em: h(30), forcado: false }, { em: h(50), forcado: true }])).toBe(h(25))
  })
  it('Y-A2: 10 linhas, todas forçadas (cadeia cheia) → âncora antiga, "sim" vencido; 9 linhas → a 9ª', () => {
    const dez = Array.from({ length: 10 }, (_, i) => ({ em: h(i + 1), forcado: true }))
    const campo = { estado: 'falhou', destino: 'B', em: h(1), forcado: true, escreveu: false, erro: null, attempts: 1 } as never
    expect(simAindaVale(campo, new Date(), inicioDoSim(dez))).toBe(false)
    expect(inicioDoSim(dez.slice(0, 9))).toBe(h(9))
    expect(inicioDoSim([...dez.slice(0, 9), { em: h(10), forcado: false }])).toBe(h(9))
  })
  it('primeira linha com forcado false → null', () => expect(inicioDoSim([{ em: h(1), forcado: false }, { em: h(2), forcado: true }])).toBeNull())
  it('sem linha → null (simAindaVale usa o em do campo)', () => expect(inicioDoSim([])).toBeNull())
  it('simAindaVale com âncora de 50 h e campo.em de 1 h → false', () => {
    expect(simAindaVale({ ...base, forcado: true, em: h(1) }, new Date(T0), h(50))).toBe(false)
    expect(simAindaVale({ ...base, forcado: true, em: h(1) }, new Date(T0), null)).toBe(true)
  })
})

describe('pulado_teste_youtube (F10)', () => {
  it('paraRestoreStatus aceita; camposPendentes ignora; podeDispensar false', () => {
    const rs = paraRestoreStatus({ title: falhou, thumbnail: { ...base, estado: 'pulado_teste_youtube' } })
    expect(rs?.thumbnail?.estado).toBe('pulado_teste_youtube')
    expect(camposPendentes(rs, 'vigia')).toEqual(['title'])
    expect(camposPendentes(rs, 'humano')).toEqual(['title'])
    expect(podeDispensar(rs!.thumbnail!)).toBe(false)
  })
  it('podeDispensar nos demais', () => {
    for (const e of ['falhou', 'desistiu', 'pulado_drift', 'pulado_sem_original'] as const) expect(podeDispensar({ ...base, estado: e })).toBe(true)
    for (const e of ['ok', 'em_andamento'] as const) expect(podeDispensar({ ...base, estado: e })).toBe(false)
  })
})

describe('simAindaVale', () => {
  const c = (hh: number, forcado = true): CampoRestauracao => ({ ...base, em: h(hh), forcado })
  it('47 h vale', () => expect(simAindaVale(c(47), new Date(T0))).toBe(true))
  it('48 h exatas não vale', () => expect(simAindaVale(c(48), new Date(T0))).toBe(false))
  it('49 h não vale', () => expect(simAindaVale(c(49), new Date(T0))).toBe(false))
  it('forcado false nunca vale', () => expect(simAindaVale(c(1, false), new Date(T0))).toBe(false))
  it('em ilegível não vale', () => expect(simAindaVale({ ...c(1), em: 'x' }, new Date(T0))).toBe(false))
})

describe('camposPendentes', () => {
  it('humano: desistiu/destino_invalido não é pendente (N1)', () => {
    expect(camposPendentes({ title: { ...desistiuTres, motivo: 'destino_invalido' } }, 'humano')).toEqual([])
  })
  it('vigia: só falhou', () => expect(camposPendentes({ title: falhou, thumbnail: desistiuTres }, 'vigia')).toEqual(['title']))
  it('humano: falhou e desistiu, menos novo_teste', () => {
    expect(camposPendentes({ thumbnail: desistiuTres, title: falhou }, 'humano')).toEqual(['title', 'thumbnail'])
    expect(camposPendentes({ thumbnail: { ...desistiuTres, motivo: 'novo_teste' } }, 'humano')).toEqual([])
  })
  it('nulo e {} → []', () => { expect(camposPendentes(null, 'vigia')).toEqual([]); expect(camposPendentes({}, 'humano')).toEqual([]) })
})

describe('proximaVerificacao', () => {
  it('09:59 UTC → 10:00 do mesmo dia', () => expect(proximaVerificacao(new Date('2026-10-20T09:59:00Z')).toISOString()).toBe('2026-10-20T10:00:00.000Z'))
  it('10:00 exato → 20:00', () => expect(proximaVerificacao(new Date('2026-10-20T10:00:00Z')).toISOString()).toBe('2026-10-20T20:00:00.000Z'))
  it('20:30 → 10:00 do dia seguinte', () => expect(proximaVerificacao(new Date('2026-10-20T20:30:00Z')).toISOString()).toBe('2026-10-21T10:00:00.000Z'))
})

describe('vigiaAtrasado', () => {
  it('nulo → atrasado', () => expect(vigiaAtrasado(null, new Date(T0))).toBe(true))
  it('ilegível → atrasado', () => expect(vigiaAtrasado('x', new Date(T0))).toBe(true))
  it('14 h → em dia; 15 h e 1 min → atrasado', () => {
    expect(vigiaAtrasado(h(14), new Date(T0))).toBe(false)
    expect(vigiaAtrasado(new Date(T0 - 15 * 3_600_000 - 60_000).toISOString(), new Date(T0))).toBe(true)
  })
  it('constante', () => expect(ATRASO_DO_VIGIA_MS).toBe(15 * 3_600_000))
})

describe('Y-9: horários do vigia batem com o vercel.json', () => {
  it('ab-watchdog roda nas horas de HORAS_DO_VIGIA_UTC', () => {
    const cfg = JSON.parse(readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8')) as { crons: { path: string; schedule: string }[] }
    const horas = cfg.crons.filter(c => c.path === '/api/cron/ab-watchdog').map(c => Number(c.schedule.split(' ')[1])).sort((a, b) => a - b)
    expect(horas).toEqual([...HORAS_DO_VIGIA_UTC])
  })
})
