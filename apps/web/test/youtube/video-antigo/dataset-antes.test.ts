// @vitest-environment node
// M10a, Tarefa 0 (Yannis Y3): o retrato do conjunto de dados ANTES de qualquer edição da etapa.
// Gerar de novo só por decisão: GERAR_GOLDEN=1 npx vitest run apps/web/test/youtube/video-antigo/dataset-antes.test.ts
// A Tarefa 12 compara com este arquivo, não com o código novo.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { rowsToDataset } from '@/lib/youtube/observatorio/load'
import { GOLDEN, NOW_FIXO, fixtureMaior } from './dataset-antes-fixture'

describe('retrato do conjunto de dados antes da M10a', () => {
  it('rowsToDataset(fixtureMaior, NOW_FIXO) é idêntico ao arquivo gravado', () => {
    const atual = JSON.stringify(rowsToDataset(fixtureMaior(), NOW_FIXO), null, 1)
    if (process.env.GERAR_GOLDEN === '1') writeFileSync(GOLDEN, atual + '\n')
    expect(existsSync(GOLDEN)).toBe(true)
    expect(atual + '\n').toBe(readFileSync(GOLDEN, 'utf8'))
  })
})
