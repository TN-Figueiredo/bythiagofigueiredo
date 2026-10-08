// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { ehSchemaAusente, conferirBanco, pushUnico } from '@/lib/youtube/coleta/schema'

describe('schema ausente', () => {
  it.each(['42P01', '42703', 'PGRST204', 'PGRST205', 'PGRST202', '42883'])('código %s é schema ausente', (code) => {
    expect(ehSchemaAusente({ code, message: 'x' })).toBe(true)
  })

  it('outro código, erro sem código e ausência de erro não são schema ausente', () => {
    expect(ehSchemaAusente({ code: '23505', message: 'x' })).toBe(false)
    expect(ehSchemaAusente({ message: 'x' })).toBe(false)
    expect(ehSchemaAusente(null)).toBe(false)
    expect(ehSchemaAusente(undefined)).toBe(false)
  })

  it('conferirBanco: sem erro devolve ok e não toca em falhas', () => {
    const falhas: string[] = []
    expect(conferirBanco({ error: null }, 'yt_reporting_jobs', falhas)).toBe('ok')
    expect(conferirBanco(undefined, 'yt_reporting_jobs', falhas)).toBe('ok')
    expect(falhas).toEqual([])
  })

  it('conferirBanco: tabela ausente (42P01) e coluna ausente (PGRST204) viram schema_ausente, uma nota só por tabela', () => {
    const falhas: string[] = []
    expect(conferirBanco({ error: { code: '42P01', message: 'relation does not exist' } }, 'yt_own_video_meta_daily', falhas)).toBe('schema_ausente')
    expect(conferirBanco({ error: { code: 'PGRST204', message: 'column not found' } }, 'yt_own_video_meta_daily', falhas)).toBe('schema_ausente')
    expect(falhas).toEqual(['schema_ausente: yt_own_video_meta_daily'])
  })

  it('conferirBanco: outro erro vira nota legível, sem o texto do Postgres', () => {
    const falhas: string[] = []
    expect(conferirBanco({ error: { code: '23505', message: 'duplicate key value violates unique constraint "segredo"' } }, 'yt_reporting_reports', falhas)).toBe('erro')
    expect(conferirBanco({ error: { code: '57014', message: 'statement timeout' } }, 'youtube_videos', falhas, 'ler')).toBe('erro')
    expect(falhas).toEqual(['erro de banco ao gravar yt_reporting_reports', 'erro de banco ao ler youtube_videos'])
  })

  it('pushUnico não repete', () => {
    const falhas = ['a']
    pushUnico(falhas, 'a')
    pushUnico(falhas, 'b')
    expect(falhas).toEqual(['a', 'b'])
  })
})
