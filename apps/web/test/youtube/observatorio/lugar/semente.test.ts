// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  MARCA_FIM, MARCA_INICIO, aliasesNormalizados, gerarSql, lerSemente, type Semente,
} from '../../../../scripts/gerar-semente-lugares'
import { normalizarLugar } from '../../../../src/lib/youtube/observatorio/lugar/normalizar'

const RAIZ = resolve(__dirname, '../../../../../..')
const JSON_V2 = resolve(__dirname, '../../../../data/lugares/semente-v2.json')
const semente = lerSemente(readFileSync(JSON_V2, 'utf8'))

function blocoDaMigration(): string {
  const dir = resolve(RAIZ, 'supabase/migrations')
  // a última migration que carrega o bloco da semente (v2: lugar_semente_v2)
  const arq = readdirSync(dir).filter((f) => f.endsWith('_lugar_semente_v2.sql')).sort().pop()
  if (!arq) throw new Error('migration lugar_semente_v2 não encontrada')
  const sql = readFileSync(resolve(dir, arq), 'utf8')
  const ini = sql.indexOf(MARCA_INICIO)
  const fim = sql.indexOf(MARCA_FIM)
  if (ini < 0 || fim < 0) throw new Error('marcadores da semente ausentes na migration')
  return sql.slice(ini, fim + MARCA_FIM.length) + '\n'
}

describe('semente de lugares v2', () => {
  it('deriva: o bloco colado na migration é idêntico ao SQL regenerado do JSON', () => {
    expect(blocoDaMigration()).toBe(gerarSql(semente))
  })

  it('a deriva é detectada: editar o JSON muda o SQL', () => {
    const outra: Semente = structuredClone(semente)
    outra.lugares[0].aliases.push({ alias: 'Alias Inventado Xyz', ambiguo: false })
    expect(gerarSql(outra)).not.toBe(blocoDaMigration())
  })

  it('v2 removendo um alias emite delete ... not in (...) antes do upsert, sem o alias removido', () => {
    const v2: Semente = structuredClone(semente)
    v2.versao = 2
    const removido = normalizarLugar(v2.lugares[0].aliases[0].alias)
    v2.lugares[0].aliases.shift()
    const sql = gerarSql(v2)
    const iDelete = sql.indexOf('delete from public.lugar_aliases where alias_norm not in (')
    const iUpsert = sql.indexOf('insert into public.lugar_aliases')
    expect(iDelete).toBeGreaterThan(-1)
    expect(iDelete).toBeLessThan(iUpsert)
    expect(sql).not.toContain(`'${removido}'`)
    expect(sql).toContain('semente_versao = excluded.semente_versao')
  })

  it('não há alias normalizado duplicado, e o gerador recusa a duplicata', () => {
    const norms = aliasesNormalizados(semente).map((a) => a.alias_norm)
    expect(new Set(norms).size).toBe(norms.length)
    const dup: Semente = structuredClone(semente)
    dup.lugares[1].aliases.push({ alias: dup.lugares[0].aliases[0].alias.toUpperCase(), ambiguo: false })
    expect(() => gerarSql(dup)).toThrow(/repetido/)
  })

  it('todo local: tem o pais: correspondente', () => {
    const paises = new Set(semente.lugares.filter((l) => l.nivel === 'pais').map((l) => l.pais_iso2))
    const locais = semente.lugares.filter((l) => l.nivel === 'local')
    expect(locais.length).toBeGreaterThan(0)
    for (const l of locais) {
      expect(l.slug.startsWith('local:'), l.slug).toBe(true)
      expect(paises.has(l.pais_iso2), `${l.slug} sem pais:${l.pais_iso2}`).toBe(true)
      expect(semente.lugares.some((p) => p.slug === `pais:${l.pais_iso2}`), l.slug).toBe(true)
    }
  })

  it('os 11 ambíguos marcados (no mínimo; a lista é piso)', () => {
    const marcados = new Set(aliasesNormalizados(semente).filter((a) => a.ambiguo).map((a) => a.alias_norm))
    for (const a of ['Natal', 'Porto', 'Lima', 'Cuba', 'Salvador', 'Belém', 'Vitória', 'Georgia', 'Jordan', 'Chad', 'Turkey']) {
      expect(marcados.has(normalizarLugar(a)), a).toBe(true)
    }
  })

  it('"Turquia" e "Türkiye" não são ambíguos e apontam para pais:TR', () => {
    const por = new Map(aliasesNormalizados(semente).map((a) => [a.alias_norm, a]))
    for (const a of ['Turquia', 'Türkiye']) {
      const l = por.get(normalizarLugar(a))
      expect(l?.slug, a).toBe('pais:TR')
      expect(l?.ambiguo, a).toBe(false)
    }
  })
})
