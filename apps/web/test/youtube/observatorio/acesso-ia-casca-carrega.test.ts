// @vitest-environment node
// A casca do comando de criar chave tem de CARREGAR fora do Next: `server-only` não está instalado e só o vitest tem stub.
// Roda o comando exato do runbook sem argumentos: recusa antes de montar cliente (nada é criado, nenhum banco é tocado).
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RAIZ_REPO = join(__dirname, '../../../../..')
const PRELOAD = './apps/web/scripts/_sem-server-only.cjs'

describe('casca observatorio-acesso.ts', () => {
  it('o comando do runbook leva o preload de server-only', () => {
    const runbook = readFileSync(join(RAIZ_REPO, 'docs/ops/observatorio-acesso-ia.md'), 'utf8')
    expect(runbook).toContain(`--require ${PRELOAD}`)
  })

  it('carrega e recusa o subcomando ausente com código 2, sem tocar banco', () => {
    let saida = ''
    let codigo = 0
    try {
      execFileSync('npx', ['tsx', '--tsconfig', 'apps/web/tsconfig.json', '--require', PRELOAD, 'apps/web/scripts/observatorio-acesso.ts'], {
        cwd: RAIZ_REPO,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '' },
      })
    } catch (e) {
      const erro = e as { status: number; stderr: string }
      codigo = erro.status
      saida = erro.stderr
    }
    expect(saida).not.toContain('Cannot find module')
    expect(saida).toContain('recusado: subcomando')
    expect(codigo).toBe(2)
  }, 30_000)
})
