// @vitest-environment node
/**
 * Teste de forma (item 1.5 da onda 1): nenhum arquivo de `apps/web/test` apaga `competitor_channels` ou `sites` direto.
 * Com a M3b no banco, o delete de canal (e o de site, em cascata) exige a declaração do destino na mesma transação; a limpeza
 * de teste passa por `test/helpers/limpa-cena.ts` (`apagarCanais`, `apagarSites`, `apagarCanaisDeTeste`, `apagarSitesDeTeste`),
 * que declara quando a M3b existe e faz o `delete` puro quando não. Sem este teste, o primeiro teste novo da A5 ou do A/B que
 * apaga canal direto quebra a CI no dia em que a M3b entrar.
 *
 * Roda sem banco. Falha com o caminho do arquivo e a linha.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, sep } from 'node:path'

const RAIZ = fileURLToPath(new URL('../', import.meta.url))   // apps/web/test

/** Exceções explícitas (caminho relativo a apps/web/test, com `/`) e o motivo de cada uma. */
const EXCECOES: Record<string, string> = {
  'helpers/limpa-cena.ts': 'o próprio helper (o delete puro é o caminho de quando a M3b não está no banco)',
  'manutencao/limpeza-de-teste-forma.test.ts': 'este teste cita os padrões que procura',
  'fixtures/sql/a5-e10-mg6.sql': 'fixture com corpo de função (competitor_channel_remove_archived), não é limpeza de teste',
  'integration/limpa-cena-db.test.ts': 'prova que o delete direto é recusado pelo gatilho (de propósito) antes de provar o helper',
  'integration/observatorio-a5-e9-migration.test.ts': 'corpo de função de teste (SQL de uma função), não é limpeza',
  'integration/manutencao-m3b-e10-remocao.test.ts': 'corpo de função de teste (SQL de uma função), não é limpeza',
  'integration/manutencao-m3b-remocao.test.ts': 'prova o gatilho e limpa depois (vários deletes diretos são de propósito, para provar a recusa)',
  'integration/manutencao-m3b-pendencias.test.ts': 'prova o gatilho e limpa depois (apaga sob session_replication_role = replica, sem declarar, de propósito)',
  'integration/manutencao-m3b-selagem.test.ts': 'prova o gatilho e limpa depois',
  'integration/manutencao-m3b-plano.test.ts': 'prova o gatilho e limpa depois',
}

const PADROES: { nome: string; re: RegExp }[] = [
  { nome: 'delete from', re: /delete\s+from\s+(public\.)?(competitor_channels|sites)(?![a-z_])/i },
  { nome: 'truncate', re: /truncate[^;`'"]*\b(competitor_channels|sites)(?![a-z_])/i },
  { nome: '.from().delete()', re: /from\(\s*['"](competitor_channels|sites)['"]\s*\)\s*\.delete\s*\(/ },
]

function arquivos(dir: string): string[] {
  const saida: string[] = []
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) saida.push(...arquivos(p))
    else if (/\.(ts|tsx|sql)$/.test(n)) saida.push(p)
  }
  return saida
}

describe('limpeza de teste: nenhum arquivo apaga competitor_channels/sites direto', () => {
  it('fora das exceções declaradas, só o helper apaga', () => {
    const achados: string[] = []
    for (const p of arquivos(RAIZ)) {
      const rel = relative(RAIZ, p).split(sep).join('/')
      if (rel in EXCECOES) continue
      readFileSync(p, 'utf8').split('\n').forEach((linha, i) => {
        for (const { nome, re } of PADROES) if (re.test(linha)) achados.push(`${rel}:${i + 1} (${nome}): use apagarCanais/apagarSites (test/helpers/limpa-cena.ts)`)
      })
    }
    expect(achados).toEqual([])
  })

  it('cada exceção ainda existe (a lista não apodrece)', () => {
    const sumidas = Object.keys(EXCECOES).filter(rel => !existsSync(join(RAIZ, rel)))
    expect(sumidas).toEqual([])
  })

  it('o padrão pega o que deve (mutante)', () => {
    const ruins = ['await pg.query(`delete from public.sites where id = $1`)', "await sb.from('competitor_channels').delete().eq('x', 1)", 'truncate public.competitor_channels', 'DELETE FROM sites']
    for (const r of ruins) expect(PADROES.some(p => p.re.test(r)), r).toBe(true)
    const bons = ['delete from public.competitor_channels_x', 'delete from public.sites_extra', "from('sites').select('*')"]
    for (const b of bons) expect(PADROES.some(p => p.re.test(b)), b).toBe(false)
  })
})
