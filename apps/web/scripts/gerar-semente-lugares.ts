// F2 · T2: gera o SQL da semente de lugares a partir de data/lugares/semente-v<N>.json (fonte única).
//   npx tsx scripts/gerar-semente-lugares.ts [caminho-do-json]   (imprime o SQL; cole entre os marcadores da migration)
// A migration carrega o bloco entre `-- >>> SEMENTE-LUGARES` e `-- <<< SEMENTE-LUGARES`; o teste regenera e compara.
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { normalizarLugar } from '../src/lib/youtube/observatorio/lugar/normalizar'

const SementeSchema = z.object({
  versao: z.number().int().positive(),
  lugares: z.array(z.object({
    slug: z.string().min(1),
    pais_iso2: z.string().length(2),
    nivel: z.enum(['pais', 'local']),
    aliases: z.array(z.object({ alias: z.string().min(1), ambiguo: z.boolean() })),
  })),
})
export type Semente = z.infer<typeof SementeSchema>

export const MARCA_INICIO = '-- >>> SEMENTE-LUGARES'
export const MARCA_FIM = '-- <<< SEMENTE-LUGARES'

const lit = (s: string): string => `'${s.replace(/'/g, "''")}'`

export function lerSemente(texto: string): Semente {
  return SementeSchema.parse(JSON.parse(texto))
}

/** Aliases já normalizados, na ordem do JSON; recusa o mesmo alias normalizado em dois slugs (ou repetido no mesmo). */
export function aliasesNormalizados(s: Semente): Array<{ alias_norm: string; slug: string; ambiguo: boolean }> {
  const vistos = new Map<string, string>()
  const saida: Array<{ alias_norm: string; slug: string; ambiguo: boolean }> = []
  for (const l of s.lugares) {
    for (const a of l.aliases) {
      const norm = normalizarLugar(a.alias)
      if (norm === '') throw new Error(`alias vazio após normalizar: "${a.alias}" (${l.slug})`)
      const dono = vistos.get(norm)
      if (dono !== undefined) throw new Error(`alias normalizado repetido: "${norm}" em ${dono} e ${l.slug}`)
      vistos.set(norm, l.slug)
      saida.push({ alias_norm: norm, slug: l.slug, ambiguo: a.ambiguo })
    }
  }
  return saida
}

/** SQL idempotente: sincroniza lugares e aliases com a semente (remove o que saiu, upserta o que ficou). */
export function gerarSql(s: Semente): string {
  const aliases = aliasesNormalizados(s)
  const v = s.versao
  const out: string[] = [MARCA_INICIO + ` v${v}`]
  out.push(`insert into public.lugares (slug, pais_iso2, nivel) values`)
  out.push(s.lugares.map(l => `  (${lit(l.slug)}, ${lit(l.pais_iso2)}, ${lit(l.nivel)})`).join(',\n'))
  out.push(`on conflict (slug) do update set pais_iso2 = excluded.pais_iso2, nivel = excluded.nivel;`)
  out.push(`delete from public.lugar_aliases where alias_norm not in (`)
  out.push(aliases.map(a => `  ${lit(a.alias_norm)}`).join(',\n'))
  out.push(`);`)
  out.push(`delete from public.lugares where slug not in (${s.lugares.map(l => lit(l.slug)).join(', ')});`)
  out.push(`insert into public.lugar_aliases (alias_norm, slug, ambiguo, semente_versao) values`)
  out.push(aliases.map(a => `  (${lit(a.alias_norm)}, ${lit(a.slug)}, ${a.ambiguo}, ${v})`).join(',\n'))
  out.push(`on conflict (alias_norm) do update set slug = excluded.slug, ambiguo = excluded.ambiguo, semente_versao = excluded.semente_versao;`)
  out.push(MARCA_FIM)
  return out.join('\n') + '\n'
}

if (process.argv[1]?.endsWith('gerar-semente-lugares.ts')) {
  const caminho = process.argv[2] ?? new URL('../data/lugares/semente-v1.json', import.meta.url).pathname
  process.stdout.write(gerarSql(lerSemente(readFileSync(caminho, 'utf8'))))
}
