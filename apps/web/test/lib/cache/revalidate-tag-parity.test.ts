// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

/**
 * Catraca de paridade de cache — Next 16.
 *
 * O `revalidateTag(tag)` de um argumento do Next 15 purgava o cache na hora.
 * No Next 16 o segundo argumento e obrigatorio, e um perfil nomeado
 * (`'seconds'`, `'minutes'`, `'max'`...) define `expired = agora + expire`:
 * ate la o Next serve o valor VELHO e revalida em background — no data cache
 * tambem, nao so no de rota.
 *
 * Medido em next@16.3.4, build de producao, rajada de 50 requests logo apos
 * invalidar (ver docs/ops/next16-wp2-lotes/CORRECAO-perfis-vs-paridade.md):
 *
 *   { expire: 0 }   0/50 respostas velhas   (x-nextjs-cache: MISS)
 *   'seconds'      46/50 respostas velhas   (STALE)
 *   'minutes'      44/50 respostas velhas   (STALE)
 *
 * `{ expire: 0 }` e o unico equivalente ao comportamento do Next 15. A
 * migracao inicial escolheu perfis nomeados em 172 call sites e introduziu
 * uma regressao silenciosa de frescor em toda superficie publica; este teste
 * existe para que isso nao volte.
 *
 * Nenhum teste de unidade pega isso: o `vitest.config.ts` mocka `next/cache`
 * globalmente, entao os asserts so conferem o argumento passado, nunca a
 * purga real. Por isso a verificacao aqui e estatica, sobre o codigo-fonte.
 *
 * Adotar um perfil nomeado e uma decisao de produto legitima — "esta
 * superficie tolera X de conteudo velho em troca de menos carga" — mas
 * deliberada, uma tag por vez. Para isso, acrescente a linha em ALLOWLIST
 * com a justificativa.
 */

const ALLOWLIST: ReadonlyArray<{ file: string; line: number; why: string }> = []

const ROOT = path.resolve(__dirname, '../../..')

function grepRevalidateTagCalls(): string[] {
  // -r sobre os dois diretorios de fonte; o `|| true` evita que exit 1 (zero
  // matches) derrube o execFileSync.
  const out = execFileSync(
    'bash',
    [
      '-c',
      `grep -rn "revalidateTag(" "${ROOT}/src" "${ROOT}/lib" --include="*.ts" --include="*.tsx" || true`,
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  )
  return out
    .split('\n')
    .filter((l) => l.trim().length > 0)
    // a linha do proprio import nao e uma chamada
    .filter((l) => !/^\s*[^:]+:\d+:\s*import\b/.test(l))
    .filter((l) => !/from ['"]next\/cache['"]/.test(l))
}

describe('paridade de invalidacao de cache (Next 15 -> 16)', () => {
  const calls = grepRevalidateTagCalls()

  it('encontra as chamadas de revalidateTag no fonte', () => {
    // Guarda contra o grep silenciosamente parar de achar (caminho errado,
    // refactor de diretorio): um zero aqui tornaria o teste abaixo inutil.
    expect(calls.length).toBeGreaterThan(100)
  })

  it('nenhuma chamada usa perfil nomeado — todas purgam na hora', () => {
    const namedProfile = /revalidateTag\([^)]*,\s*['"](default|seconds|minutes|hours|days|weeks|max)['"]\s*\)/

    const offenders = calls.filter((l) => namedProfile.test(l)).filter((l) => {
      const m = l.match(/^([^:]+):(\d+):/)
      if (!m) return true
      const file = path.relative(ROOT, m[1])
      const line = Number(m[2])
      return !ALLOWLIST.some((a) => a.file === file && a.line === line)
    })

    expect(
      offenders,
      'Perfil nomeado serve conteudo VELHO ate expirar. Use { expire: 0 } ' +
        '(paridade com o Next 15) ou, em Server Action, updateTag(tag). Se o ' +
        'perfil for deliberado, acrescente a linha em ALLOWLIST com o porque.',
    ).toEqual([])
  })

  it('nenhuma chamada ficou com um argumento so', () => {
    // Um argumento nao compila no Next 16, mas o `ignoreBuildErrors: true` do
    // next.config faz o build passar mesmo assim — so o tsc pega, e este teste
    // e a segunda rede.
    const singleArg = calls.filter((l) => {
      const call = l.replace(/^[^:]+:\d+:/, '')
      return /revalidateTag\([^),]*\)/.test(call)
    })
    expect(singleArg).toEqual([])
  })
})
