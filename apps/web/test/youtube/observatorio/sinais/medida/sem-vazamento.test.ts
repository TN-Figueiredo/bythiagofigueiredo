// @vitest-environment node
// Guarda de lista de permissão: nada fora da F2b importa `sinais/medida/` nem cita as tabelas de efeito
// antes do gatilho; `estimador.ts` não é importado fora de test/.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const RAIZ = resolve(__dirname, '../../../../../../..')
const RAIZES = ['apps/web/src', 'apps/api/src']

const IMPORTA_MEDIDA = /(?:from|import)\s*\(?\s*['"][^'"]*sinais\/medida(?:\/|['"])/
const IMPORTA_ESTIMADOR = /['"][^'"]*medida\/estimador['"]/
const CITA_TABELA = /niche_signal_efeitos|niche_signal_efeito_bracos/

const PODE_IMPORTAR = [/^apps\/web\/src\/lib\/youtube\/observatorio\/sinais\/medida\//, /^apps\/web\/src\/lib\/youtube\/observatorio\/agenda\/tarefas\/medida-d2\.ts$/]
const PODE_CITAR = [/^apps\/web\/src\/lib\/youtube\/observatorio\/sinais\/medida\//, /database\.types\.ts$/, /^supabase\/migrations\//]

export function violacoes(arquivos: { caminho: string; texto: string }[]): string[] {
  const out: string[] = []
  for (const { caminho, texto } of arquivos) {
    if (IMPORTA_MEDIDA.test(texto) && !PODE_IMPORTAR.some(r => r.test(caminho))) out.push(`${caminho}: importa sinais/medida`)
    if (IMPORTA_ESTIMADOR.test(texto) && !/^apps\/(web|api)\/test\//.test(caminho)) out.push(`${caminho}: importa estimador`)
    if (CITA_TABELA.test(texto) && !PODE_CITAR.some(r => r.test(caminho))) out.push(`${caminho}: cita tabela de efeito`)
  }
  return out
}

function listar(dir: string): string[] {
  return readdirSync(dir).flatMap(n => {
    if (n === 'node_modules' || n === '.next') return []
    const p = join(dir, n)
    return statSync(p).isDirectory() ? listar(p) : /\.(ts|tsx)$/.test(n) ? [p] : []
  })
}

describe('F2b não vaza antes do gatilho', () => {
  it('varre src de web e api', () => {
    const arquivos = RAIZES.flatMap(r => listar(join(RAIZ, r))).map(p => ({ caminho: relative(RAIZ, p), texto: readFileSync(p, 'utf8') }))
    expect(arquivos.length).toBeGreaterThan(100)
    expect(violacoes(arquivos)).toEqual([])
  })
  it('o guarda morde: arquivo fora da lista é devolvido pelo nome', () => {
    const r = violacoes([
      { caminho: 'apps/web/src/lib/x/intruso.ts', texto: "import { janelasDoPar } from '@/lib/youtube/observatorio/sinais/medida/janela'" },
      { caminho: 'apps/web/src/app/y.ts', texto: "import { e } from '@/lib/youtube/observatorio/sinais/medida/estimador'" },
      { caminho: 'apps/api/src/z.ts', texto: "from('niche_signal_efeitos')" },
      { caminho: 'apps/web/src/lib/youtube/observatorio/agenda/tarefas/medida-d2.ts', texto: "import { a } from '../../sinais/medida/janela'" },
    ])
    expect(r.some(s => s.startsWith('apps/web/src/lib/x/intruso.ts'))).toBe(true)
    expect(r.some(s => s.startsWith('apps/web/src/app/y.ts') && s.includes('estimador'))).toBe(true)
    expect(r.some(s => s.startsWith('apps/api/src/z.ts'))).toBe(true)
    expect(r.some(s => s.includes('medida-d2.ts'))).toBe(false)
  })
})
