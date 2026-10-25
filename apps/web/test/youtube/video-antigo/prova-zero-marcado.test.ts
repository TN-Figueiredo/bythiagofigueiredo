// @vitest-environment node
// M10a (Tarefa 12, item 135): com zero vídeo marcado, o conjunto de dados das telas é idêntico ao de ANTES da etapa, byte a byte.
// Compara com o ouro da Tarefa 0 (__golden__/dataset-antes.json), nunca com o código novo. Sem vi.mock do predicado (Yannis Y3).
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { rowsToDataset } from '@/lib/youtube/observatorio/load'
import { GOLDEN, NOW_FIXO, fixtureMaior } from './dataset-antes-fixture'

const ouro = () => readFileSync(GOLDEN, 'utf8')
const texto = (r: ReturnType<typeof fixtureMaior>) => JSON.stringify(rowsToDataset(r, NOW_FIXO), null, 1) + '\n'

describe('M10a: zero vídeo marcado = conjunto de dados idêntico ao de antes', () => {
  it('o ouro existe e tem vídeos', () => {
    expect(existsSync(GOLDEN)).toBe(true)
    expect(JSON.parse(ouro()).videos.length).toBeGreaterThan(3)
  })
  it('(a) linhas sem as chaves archive_*: idêntico ao ouro', () => {
    const r = fixtureMaior()
    for (const v of [...r.videos, ...r.ownVideos]) { expect('archive_frozen_at' in v).toBe(false) }
    expect(texto(r)).toBe(ouro())
  })
  it('(b) linhas com archive_frozen_at e archive_dropped_at nulos: idêntico ao ouro', () => {
    const r = fixtureMaior()
    r.videos = r.videos.map(v => ({ ...v, archive_frozen_at: null, archive_dropped_at: null }))
    r.ownVideos = r.ownVideos.map(v => ({ ...v, archive_frozen_at: null, archive_dropped_at: null }))
    expect(texto(r)).toBe(ouro())
  })
  it('contraprova: um vídeo marcado muda o conjunto (o teste não é vazio)', () => {
    const r = fixtureMaior()
    r.videos = r.videos.map(v => v.id === 'v6' ? { ...v, archive_frozen_at: '2026-10-01T00:00:00Z' } : v)
    expect(texto(r)).not.toBe(ouro())
  })
})
