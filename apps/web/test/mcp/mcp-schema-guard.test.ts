// @vitest-environment node
/**
 * Guarda de esquema: toda tabela, coluna e RPC que o servidor MCP do pipeline e os serviços de
 * `/api/pipeline` consultam existe em `src/types/database.types.ts`.
 *
 * Por quê: o supabase-js responde tabela/coluna inexistente com `{ data: null, error }`, não com
 * exceção. O código descartava o `error` e o recurso saía vazio ou "Unknown" — `youtube_ab_tests`
 * (a tabela é `ab_tests`), `content_pipeline.archived` (é `is_archived`), `pipeline_context`,
 * `competitor_changes.field`, `link_click_aggregates`... e nada, nem o typecheck (o cliente é
 * frouxo), nem 13 mil testes com dublê, percebia. O extrator é `test/helpers/schema-audit.ts`.
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { auditDirs, auditFile, loadSchema } from '../helpers/schema-audit'

const WEB = resolve(__dirname, '../..')
// src/lib/pipeline é recursivo (mcp/, services/ e os helpers soltos); as rotas REST do pipeline vêm à parte
const DIRS = ['src/lib/pipeline', 'src/app/api/pipeline']

describe('MCP + serviços do pipeline: esquema', () => {
  const { refs } = auditDirs(WEB, DIRS)

  it('o extrator enxerga o código (não pode ficar cego em silêncio)', () => {
    // arquivos-chave com consulta ao banco: cada um tem de render referências (um refactor que
    // mude o número total não quebra; um extrator cego quebra)
    for (const f of ['src/lib/pipeline/mcp/resources.ts', 'src/lib/pipeline/mcp/prompts.ts', 'src/lib/pipeline/services/items.ts', 'src/lib/pipeline/services/youtube.ts', 'src/lib/pipeline/services/utilities.ts']) {
      expect(refs.filter(r => r.file === f).length, f).toBeGreaterThan(0)
    }
    const tables = new Set(refs.filter(r => r.kind === 'from').map(r => r.table))
    for (const t of ['content_pipeline', 'ab_tests', 'competitor_changes', 'audio_assets', 'youtube_channels']) {
      expect(tables.has(t), t).toBe(true)
    }
  })

  it('toda tabela, coluna e RPC consultada existe em database.types.ts', () => {
    const missing = refs
      .filter(r => !r.exists && !r.kind.startsWith('embed:'))
      .map(r => `${r.file}:${r.line}  ${r.table}${r.column ? `.${r.column}` : ''}  (${r.kind})`)
    expect([...new Set(missing)]).toEqual([])
  })

  it('o extrator pega o defeito que a guarda existe para pegar', () => {
    const { schema, functions } = loadSchema(join(WEB, 'src/types/database.types.ts'))
    const dir = mkdtempSync(join(tmpdir(), 'schema-guard-'))
    const f = join(dir, 'bad.ts')
    writeFileSync(f, [
      "await sb.from('youtube_ab_tests').select('id')",
      "await sb.from('content_pipeline').select('id, archived').eq('archived', false)",
      "await sb.from('competitor_changes').select('id, change_type, field').order('detected_at')",
      "await sb.from('content_pipeline').select('id, research_topics(nome)').update({ is_archived: true, arquivado: 1 })",
      "await sb.from('content_pipeline').select('id, format').eq('is_archived', false)",
    ].join('\n'))
    const found = auditFile(f, dir, schema, functions).refs.filter(r => !r.exists && !r.kind.startsWith('embed:'))
    const names = found.map(r => `${r.table}.${r.column ?? '(tabela)'}`)
    expect(names).toEqual(expect.arrayContaining([
      'youtube_ab_tests.(tabela)',
      'content_pipeline.archived',
      'competitor_changes.field',
      'content_pipeline.arquivado',
    ]))
    // o embed `research_topics(nome)` é conferido na tabela embutida
    expect(names).toContain('research_topics.nome')
    // a linha correta não vira falso positivo
    expect(names.filter(n => n === 'content_pipeline.is_archived' || n === 'content_pipeline.format')).toEqual([])
  })
})
