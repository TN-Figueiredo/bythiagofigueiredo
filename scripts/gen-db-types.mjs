#!/usr/bin/env node
/**
 * gen-db-types.mjs — regenera apps/web/src/types/database.types.ts a partir de PROD (só leitura)
 * e REMOVE tabelas, views e funções sensíveis listadas em scripts/db-types-excluidas.json.
 *
 * Por quê: guardas de privacidade (ver "motivo" no JSON) exigem que os tipos gerados NÃO conheçam
 * tabelas de identidade/retenção; ninguém lê esse dado por tipo.
 *
 * Uso: `npm run db:types` (rede + supabase CLI logado). Teste do filtro: scripts/gen-db-types.test.mjs.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const PROJECT_ID = 'novkqtvcnsiwhkxihurk'
const DESTINO = resolve(AQUI, '../apps/web/src/types/database.types.ts')

export function carregarExcluidas() {
  const j = JSON.parse(readFileSync(resolve(AQUI, 'db-types-excluidas.json'), 'utf8'))
  return [...(j.tabelas ?? []), ...(j.funcoes ?? [])]
}

/** Remove entradas (6 espaços) de Tables/Views/Functions e objetos de Relationships que apontam para elas. */
export function filtrar(src, excluidas) {
  const set = new Set(excluidas)
  const linhas = src.split('\n')
  const out = []
  let secao = false
  let pulando = false
  let i = 0
  let removidos = 0
  while (i < linhas.length) {
    const l = linhas[i]
    if (/^    (Tables|Views|Functions): \{$/.test(l)) { secao = true; pulando = false; out.push(l); i++; continue }
    if (/^    \}/.test(l)) { secao = false; pulando = false; out.push(l); i++; continue }
    if (secao) {
      const m = /^      ([A-Za-z0-9_]+):/.exec(l)
      if (m) { pulando = set.has(m[1]); if (pulando) removidos++ }
      if (pulando) { i++; continue }
      // objeto de Relationships (10 espaços) que referencia uma relação excluída
      if (/^ {10}\{$/.test(l)) {
        let j = i + 1
        while (j < linhas.length && !/^ {10}\},?$/.test(linhas[j])) j++
        const bloco = linhas.slice(i, j + 1)
        const ref = bloco.map((b) => /referencedRelation: "([^"]+)"/.exec(b)?.[1]).find(Boolean)
        if (ref && set.has(ref)) { i = j + 1; continue }
      }
    }
    out.push(l)
    i++
  }
  filtrar.removidos = removidos
  return out.join('\n')
}

function main() {
  const excluidas = carregarExcluidas()
  const bruto = execFileSync(
    'npx',
    ['supabase@2.98.2', 'gen', 'types', 'typescript', '--project-id', PROJECT_ID, '--schema', 'public'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  writeFileSync(DESTINO, filtrar(bruto, excluidas))
  console.log(`database.types.ts gravado; ${filtrar.removidos} objeto(s) filtrado(s) de ${excluidas.length} na lista`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
