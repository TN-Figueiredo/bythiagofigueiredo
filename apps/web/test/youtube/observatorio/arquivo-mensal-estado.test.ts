// apps/web/test/youtube/observatorio/arquivo-mensal-estado.test.ts
// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { corDaRemocao, type LinhaRemocao } from '@/lib/youtube/observatorio/arquivo-mensal/estado-remocao'
import { lerCapacidades } from '@/lib/youtube/observatorio/arquivo-mensal/capacidades'

const AGORA = new Date('2027-03-01T12:00:00Z')
const dias = (n: number): string => new Date(AGORA.getTime() - n * 86_400_000).toISOString()
const base: LinhaRemocao = { estado: 'pedido', decided_at: null, reappeared_at: null, nas_absent_at: null, b2_absent_at: null, snapshots_clear_on: null, blobs_pendentes: 0 }
const cor = (l: Partial<LinhaRemocao>, o: Partial<{ casaResponde: boolean; limpezaEmProducao: boolean }> = {}) =>
  corDaRemocao({ ...base, ...l }, { agora: AGORA, casaResponde: true, limpezaEmProducao: true, ...o })

describe('cor da remoção (P38, item 163)', () => {
  it('pedido: 29 nenhuma, 30 âmbar, 59 âmbar, 60 vermelho', () => {
    expect(cor({ decided_at: dias(29) }).cor).toBe('nenhuma')
    expect(cor({ decided_at: dias(30) }).cor).toBe('ambar')
    expect(cor({ decided_at: dias(59) }).cor).toBe('ambar')
    expect(cor({ decided_at: dias(60) }).cor).toBe('vermelho')
  })
  it('a idade vem do mais recente entre decided_at e reappeared_at', () => {
    expect(cor({ decided_at: dias(200), reappeared_at: dias(1) }).cor).toBe('nenhuma')
  })
  it('linha da vigia sem decided_at: sem idade', () => { expect(cor({ estado: 'sem_destino' }).idadeDias).toBeNull() })
  it('casa fora: nenhuma cor por idade', () => { expect(cor({ decided_at: dias(90) }, { casaResponde: false }).cor).toBe('nenhuma') })
  it('apagado_nas conta de nas_absent_at', () => {
    expect(cor({ estado: 'apagado_nas', decided_at: dias(300), nas_absent_at: dias(29) }).cor).toBe('nenhuma')
    expect(cor({ estado: 'apagado_nas', decided_at: dias(300), nas_absent_at: dias(60) }).cor).toBe('vermelho')
  })
  it('apagado_b2: 14 nenhuma e 15 âmbar depois dos snapshots; sem snapshots, 30 dias de b2_absent_at', () => {
    expect(cor({ estado: 'apagado_b2', snapshots_clear_on: dias(14).slice(0, 10) }).cor).toBe('nenhuma')
    expect(cor({ estado: 'apagado_b2', snapshots_clear_on: dias(15).slice(0, 10) }).cor).toBe('ambar')
    expect(cor({ estado: 'apagado_b2', b2_absent_at: dias(30) }).cor).toBe('ambar')
  })
  it('imagens no Blob: 13, 14, 29 e 30 dias com o comando; cinza sempre sem ele', () => {
    expect(cor({ decided_at: dias(13), blobs_pendentes: 2 }).blob).toBe('nenhuma')
    expect(cor({ decided_at: dias(14), blobs_pendentes: 2 }).blob).toBe('ambar')
    expect(cor({ decided_at: dias(29), blobs_pendentes: 2 }).blob).toBe('ambar')
    expect(cor({ decided_at: dias(30), blobs_pendentes: 2 }).blob).toBe('vermelho')
    for (const n of [13, 14, 30]) expect(cor({ decided_at: dias(n), blobs_pendentes: 2 }, { limpezaEmProducao: false }).blob).toBe('cinza')
  })
})

describe('capacidades (P54, item 163)', () => {
  const salvo = { ...process.env }
  afterEach(() => { process.env = { ...salvo } })
  it('variável apagada: o comando não existe', () => {
    delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL
    delete process.env.OBS_ARQUIVO_LIMPEZA_CANAL_DATA
    expect(lerCapacidades()).toEqual({ comandoDeLimpeza: false, blocoCanaisRemovidos: true, dataDoComando: null }) // M5 T9: o bloco foi entregue
  })
  it('só on liga', () => {
    for (const v of ['ON', '1', 'true', '', ' on']) expect(lerCapacidades({ OBS_ARQUIVO_LIMPEZA_CANAL: v } as NodeJS.ProcessEnv).comandoDeLimpeza).toBe(false)
  })
  it('com o bloco entregue (M5 T9), "on" liga o comando (a tabela do §14.3 cai na linha "bloco sim")', () => {
    expect(lerCapacidades({ OBS_ARQUIVO_LIMPEZA_CANAL: 'on' } as NodeJS.ProcessEnv)).toMatchObject({ comandoDeLimpeza: true, blocoCanaisRemovidos: true })
  })
  it('a data é só texto', () => {
    expect(lerCapacidades({ OBS_ARQUIVO_LIMPEZA_CANAL_DATA: '02/03' } as NodeJS.ProcessEnv).dataDoComando).toBe('02/03')
  })
})
