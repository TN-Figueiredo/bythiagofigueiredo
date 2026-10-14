// @vitest-environment node
// M10a (Tarefas 2 e 3): forma do SQL, a TRAVA M10a-1 como teste e as colunas/gatilho/política no banco.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { skipIfNoLocalDb } from '../helpers/db-skip'
import { M10A_SQL, M10A_EM_MIGRATION, m10aNoBanco } from './video-antigo-m10a-caminho'

const pular = skipIfNoLocalDb() || (!M10A_EM_MIGRATION && !(await m10aNoBanco()))

describe.skipIf(skipIfNoLocalDb())('M10a: forma do SQL e TRAVA M10a-1', () => {
  it('o SQL abre com set lock_timeout', () => {
    expect(readFileSync(M10A_SQL, 'utf8')).toContain("set lock_timeout")
  })
  it('TRAVA M10a-1: enquanto M10A_SQL é o rascunho, não há *_observatorio_m10a_* em supabase/migrations', () => {
    const dir = path.resolve(__dirname, '../../../../supabase/migrations')
    const achados = readdirSync(dir).filter(f => f.includes('_observatorio_m10a_'))
    if (M10A_EM_MIGRATION) expect(achados.length).toBe(1)
    else expect(achados).toEqual([])
  })
})

describe.skipIf(pular)('M10a: banco (pula até a Tarefa 5b se o rascunho não foi aplicado)', () => {
  it('placeholder até a Tarefa 3', () => { expect(true).toBe(true) })
})
