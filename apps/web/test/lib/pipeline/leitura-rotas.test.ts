// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { rotaNormalizada } from '@/lib/pipeline/leitura-registro'

const RAIZ = join(process.cwd(), 'src/app/api/pipeline')
function rotas(dir: string, prefixo: string): string[] {
  const out: string[] = []
  for (const nome of readdirSync(dir)) {
    const cheio = join(dir, nome)
    if (statSync(cheio).isDirectory()) out.push(...rotas(cheio, `${prefixo}/${nome}`))
    else if (nome === 'route.ts') out.push(prefixo)
  }
  return out
}

describe('rotaNormalizada: padrão de rota do pipeline', () => {
  const todas = rotas(RAIZ, '/api/pipeline')
  it('achou as rotas (se vier vazio, a prova não prova nada)', () => {
    expect(todas.length).toBeGreaterThanOrEqual(91)
  })
  it('toda rota do disco, com valores no lugar dos [x], volta ao próprio padrão (lista em dia, estáticas intactas)', () => {
    const erradas = todas
      .map(r => ({ r, got: rotaNormalizada(r.replace(/\[[^\]]+\]/g, (m, i) => (i % 2 ? '42' : 'um-slug-qualquer'))) }))
      .filter(x => x.got !== x.r)
      .map(x => `${x.r} -> ${x.got}`)
    expect(erradas).toEqual([])
  })
  it('nunca traz query string', () => {
    expect(rotaNormalizada('/api/pipeline/topics/abc?q=segredo')).toBe('/api/pipeline/topics/[code]')
  })
})
