import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = resolve(__dirname, '../../../..')
const migrou = readdirSync(resolve(RAIZ, 'supabase/migrations')).some(n => n.includes('_manutencao_m9_'))
const PENDENCIAS = 'apps/web/src/lib/youtube/observatorio/arquivo-mensal/pendencias.ts'

describe('TRAVAs M9-1 e M9-2', () => {
  it('nenhum marcador << sobra no rascunho nem na migration', () => {
    for (const f of [resolve(RAIZ, 'supabase/rascunhos/m9.sql'), ...readdirSync(resolve(RAIZ, 'supabase/migrations')).filter(n => n.includes('_manutencao_m9_')).map(n => resolve(RAIZ, 'supabase/migrations', n))]) {
      if (existsSync(f)) expect(readFileSync(f, 'utf8')).not.toContain('<<')
    }
  })
  it('o SQL da M9 vive no rascunho ou na migration, nunca nos dois', () => {
    const rascunho = existsSync(resolve(RAIZ, 'supabase/rascunhos/m9.sql'))
    expect(rascunho !== migrou).toBe(true)
  })
  it.skipIf(migrou)('sem a migration: nem rota do expurgo nem leitor na versao 2', () => {
    expect(existsSync(resolve(RAIZ, 'apps/web/src/app/api/pipeline/archive/expurgo'))).toBe(false)
    expect(readFileSync(resolve(RAIZ, PENDENCIAS), 'utf8')).toMatch(/export const VERSAO_PENDENCIAS = 1\b/)
  })
  it.skipIf(!migrou)('com a migration: a rota do expurgo existe e o leitor está na versao 2', () => {
    expect(existsSync(resolve(RAIZ, 'apps/web/src/app/api/pipeline/archive/expurgo/route.ts'))).toBe(true)
    expect(readFileSync(resolve(RAIZ, PENDENCIAS), 'utf8')).toMatch(/export const VERSAO_PENDENCIAS = 2\b/)
  })
})
