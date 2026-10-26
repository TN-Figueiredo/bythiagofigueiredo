// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const RAIZ = resolve(__dirname, '../../../..')
interface IGen { filtrar: (src: string, excluidas: string[]) => string; carregarExcluidas: () => string[] }
const carregar = async (): Promise<IGen> => (await import(pathToFileURL(resolve(RAIZ, 'scripts/gen-db-types.mjs')).href)) as IGen

const SINTETICO = `export type Database = {
  public: {
    Tables: {
      boa: {
        Row: {
          id: string
        }
        Relationships: [
          {
            foreignKeyName: "boa_x_fkey"
            columns: ["x"]
            isOneToOne: false
            referencedRelation: "sensivel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "boa_y_fkey"
            columns: ["y"]
            isOneToOne: false
            referencedRelation: "outra"
            referencedColumns: ["id"]
          },
        ]
      }
      sensivel: {
        Row: {
          segredo: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_sensivel: {
        Args: { a: string }
        Returns: boolean
      }
      fn_boa: {
        Args: { a: string }
        Returns: boolean
      }
    }
  }
}
`

describe('filtro de tipos gerados', () => {
  it('remove tabela, função e relação sensíveis; mantém as normais; continua TypeScript válido', async () => {
    const { filtrar } = await carregar()
    const out = filtrar(SINTETICO, ['sensivel', 'fn_sensivel'])
    expect(out).not.toMatch(/sensivel|segredo/)
    expect(out).toContain('boa: {')
    expect(out).toContain('fn_boa: {')
    expect(out).toContain('referencedRelation: "outra"')
    const ts = await import('typescript')
    const diag = ts.default.transpileModule(out, { reportDiagnostics: true, compilerOptions: { target: ts.default.ScriptTarget.ES2022 } }).diagnostics ?? []
    expect(diag).toEqual([])
  })

  it('database.types.ts não contém nenhum nome da lista de exclusão', async () => {
    const { carregarExcluidas } = await carregar()
    const nomes = carregarExcluidas()
    expect(nomes.length).toBeGreaterThan(0)
    const tipos = readFileSync(resolve(RAIZ, 'apps/web/src/types/database.types.ts'), 'utf8')
    const achados = nomes.filter((n) => new RegExp(`\\b${n}\\b`).test(tipos))
    expect(achados).toEqual([])
  })
})
