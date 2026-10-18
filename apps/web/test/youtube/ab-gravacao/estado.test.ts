// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { addDays, ontemPt } from '@/lib/youtube/coleta/day-pt'
import { estadoDoAlcance, estadoDasViews, ehFinal, type RelatorioDoDia } from '@/lib/youtube/ab-gravacao/estado'

const ontem = ontemPt(new Date())
const rel = (p: Partial<RelatorioDoDia> & { create_time: string }): RelatorioDoDia => ({ report_id: 'r' + p.create_time, status: 'listado', normalized_at: null, ...p })
const base = (day: string) => ({ day, ontem })
const ALC = { thumbnail_impressions: 1234, thumbnail_ctr: 0.05, source_report_id: 'r1', report_create_time: '2026-10-01T00:00:00Z' }

describe('ehFinal', () => {
  it('D+9 não, D+10 sim', () => {
    expect(ehFinal(addDays(ontem, -9), ontem)).toBe(false)
    expect(ehFinal(addDays(ontem, -10), ontem)).toBe(true)
  })
})

describe('estadoDoAlcance', () => {
  const d2 = addDays(ontem, -2)
  const d10 = addDays(ontem, -10)
  it('sem relatório em D+2 aguarda', () => expect(estadoDoAlcance({ ...base(d2), relatorios: [], linha: null })).toBe('aguardando'))
  it('sem relatório em D+10 é nao_medido', () => expect(estadoDoAlcance({ ...base(d10), relatorios: [], linha: null })).toBe('nao_medido'))
  it('vazio normalizado é zero_medido', () => expect(estadoDoAlcance({ ...base(d2), relatorios: [rel({ create_time: '2026-10-01T00:00:00Z', status: 'vazio', normalized_at: '2026-10-01T01:00:00Z' })], linha: null })).toBe('zero_medido'))
  it('vazio sem normalized_at aguarda', () => expect(estadoDoAlcance({ ...base(d2), relatorios: [rel({ create_time: '2026-10-01T00:00:00Z', status: 'vazio' })], linha: null })).toBe('aguardando'))
  it('baixado normalizado sem linha é ausente_no_relatorio', () => expect(estadoDoAlcance({ ...base(d2), relatorios: [rel({ create_time: '2026-10-01T00:00:00Z', status: 'baixado', normalized_at: '2026-10-01T01:00:00Z' })], linha: null })).toBe('ausente_no_relatorio'))
  it('linha com 1234 é medido mesmo com o relatório mais novo listado', () => expect(estadoDoAlcance({ ...base(d2), relatorios: [rel({ create_time: '2026-10-02T00:00:00Z' })], linha: ALC })).toBe('medido'))
  it('linha com impressões nulas é nao_medido', () => expect(estadoDoAlcance({ ...base(d2), relatorios: [], linha: { ...ALC, thumbnail_impressions: null } })).toBe('nao_medido'))
  it('velho vazio normalizado + novo listado aguarda (vale o mais novo)', () => expect(estadoDoAlcance({ ...base(d2), relatorios: [
    rel({ create_time: '2026-10-01T00:00:00Z', status: 'vazio', normalized_at: '2026-10-01T01:00:00Z' }), rel({ create_time: '2026-10-02T00:00:00Z' })], linha: null })).toBe('aguardando'))
  it('velho normalizado + novo expirado_sem_baixar é nao_medido', () => expect(estadoDoAlcance({ ...base(d2), relatorios: [
    rel({ create_time: '2026-10-01T00:00:00Z', status: 'vazio', normalized_at: '2026-10-01T01:00:00Z' }), rel({ create_time: '2026-10-02T00:00:00Z', status: 'expirado_sem_baixar' })], linha: null })).toBe('nao_medido'))
  it('erro em D+3 aguarda', () => expect(estadoDoAlcance({ ...base(addDays(ontem, -3)), relatorios: [rel({ create_time: '2026-10-01T00:00:00Z', status: 'erro' })], linha: null })).toBe('aguardando'))
  it('erro em D+10 é nao_medido', () => expect(estadoDoAlcance({ ...base(d10), relatorios: [rel({ create_time: '2026-10-01T00:00:00Z', status: 'erro' })], linha: null })).toBe('nao_medido'))
  it('ordem de chegada não importa: o maior create_time vale', () => expect(estadoDoAlcance({ ...base(d2), relatorios: [
    rel({ create_time: '2026-10-02T00:00:00Z', status: 'expirado_sem_baixar' }), rel({ create_time: '2026-10-01T00:00:00Z', status: 'vazio', normalized_at: '2026-10-01T01:00:00Z' })], linha: null })).toBe('nao_medido'))
})

describe('estadoDasViews', () => {
  const day = addDays(ontem, -3)
  it('linha 0 é zero_medido', () => expect(estadoDasViews({ day, linha: { views: 0 }, coberto: false })).toBe('zero_medido'))
  it('linha 7 é medido', () => expect(estadoDasViews({ day, linha: { views: 7 }, coberto: false })).toBe('medido'))
  it('sem linha coberto é zero_medido', () => expect(estadoDasViews({ day, linha: null, coberto: true })).toBe('zero_medido'))
  it('sem linha fora da cobertura é nao_medido', () => expect(estadoDasViews({ day, linha: null, coberto: false })).toBe('nao_medido'))
  it('views nulo é nao_medido', () => expect(estadoDasViews({ day, linha: { views: null }, coberto: true })).toBe('nao_medido'))
})
