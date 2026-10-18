// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(__dirname, '../../../src')

function arquivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? arquivos(join(dir, e.name)) : [join(dir, e.name)],
  )
}

describe('rota do P-V removida', () => {
  it('a rota do P-V não existe', () => {
    expect(existsSync(join(SRC, 'app/api/cron/watch-pv'))).toBe(false)
  })
  it('nenhum arquivo em src contém watch-pv', () => {
    const achados = arquivos(SRC).filter((f) => readFileSync(f, 'utf8').includes('watch-pv'))
    expect(achados).toEqual([])
  })
})
