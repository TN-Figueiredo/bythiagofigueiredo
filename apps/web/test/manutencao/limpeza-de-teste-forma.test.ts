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
  'integration/manutencao-m3b-remocao.test.ts': 'prova o gatilho e limpa depois (deletes diretos de propósito: a corrida em 2ª conexão, linha 386, e a prova da recusa)',
  'integration/manutencao-m3b-apagar-corrida.test.ts': 'limpa a cena da corrida depois de desfazer a 000004 (delete direto de propósito, linha 88, melhor esforço)',
  'e2e/seeds/m5-arquivo.sql': 'semente do navegador (Gio, T14): recomeça a cena do site de teste no banco de integração 54422, rodada com psql, fora do vitest',
  'integration/manutencao-m3b-pendencias.test.ts': 'prova o gatilho e limpa depois (deletes diretos de propósito, linhas 167 e 177, sob session_replication_role = replica, sem declarar)',
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

/** Varre o arquivo inteiro (pega `.from('sites')\n.delete()` e `delete\n from` multilinha); a linha vem do índice. */
function acharDiretos(texto: string): { linha: number; nome: string }[] {
  const out: { linha: number; nome: string }[] = []
  for (const { nome, re } of PADROES) {
    for (const m of texto.matchAll(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'))) {
      out.push({ linha: texto.slice(0, m.index).split('\n').length, nome })
    }
  }
  return out
}

describe('limpeza de teste: nenhum arquivo apaga competitor_channels/sites direto', () => {
  it('fora das exceções declaradas, só o helper apaga', () => {
    const achados: string[] = []
    for (const p of arquivos(RAIZ)) {
      const rel = relative(RAIZ, p).split(sep).join('/')
      if (rel in EXCECOES) continue
      achados.push(...acharDiretos(readFileSync(p, 'utf8')).map(({ linha, nome }) => `${rel}:${linha} (${nome}): use apagarCanais/apagarSites (test/helpers/limpa-cena.ts)`))
    }
    expect(achados).toEqual([])
  })

  it('cada exceção ainda existe (a lista não apodrece)', () => {
    const sumidas = Object.keys(EXCECOES).filter(rel => !existsSync(join(RAIZ, rel)))
    expect(sumidas).toEqual([])
  })

  it('o padrão pega o que deve (mutante)', () => {
    const ruins = ['await pg.query(`delete from public.sites where id = $1`)', "await sb.from('competitor_channels').delete().eq('x', 1)", 'truncate public.competitor_channels', 'DELETE FROM sites', "sb\n.from('sites')\n.delete()", 'delete\n from public.sites']
    for (const r of ruins) expect(acharDiretos(r).length, r).toBeGreaterThan(0)
    const bons = ['delete from public.competitor_channels_x', 'delete from public.sites_extra', "from('sites').select('*')"]
    for (const b of bons) expect(acharDiretos(b).length, b).toBe(0)
  })
})
