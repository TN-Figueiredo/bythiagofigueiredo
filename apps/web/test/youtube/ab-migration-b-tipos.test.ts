import { describe, it, expect } from 'vitest'
import { resolve, join } from 'node:path'
import { loadSchema } from '../helpers/schema-audit'

const { schema, functions } = loadSchema(join(resolve(__dirname, '../..'), 'src/types/database.types.ts'))

describe('Migration B: os tipos já não têm o que a B apaga', () => {
  it('sem a tabela ab_test_tracked_links', () => expect(schema.has('ab_test_tracked_links')).toBe(false))
  it('ab_tests sem original_description', () => expect(schema.get('ab_tests')!.columns.has('original_description')).toBe(false))
  it('ab_test_variants sem description_text', () => expect(schema.get('ab_test_variants')!.columns.has('description_text')).toBe(false))
  it('sem a função create_playoff_test', () => expect(functions.has('create_playoff_test')).toBe(false))
  it('controle positivo: o leitor acha o que existe', () => {
    expect(schema.get('yt_own_video_meta_daily')!.columns.has('description_text')).toBe(true)
    expect(schema.get('ab_test_variants')!.columns.has('title_text')).toBe(true)
    expect(functions.has('create_waitlist_with_translation')).toBe(true)
  })
})
