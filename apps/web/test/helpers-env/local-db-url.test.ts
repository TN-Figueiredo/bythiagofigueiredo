// @vitest-environment node
// A URL da API do banco local dos testes de integração vem de NEXT_PUBLIC_SUPABASE_URL (a mesma que o código sob teste lê);
// sem a variável, o padrão do `supabase start` (54321). Regra de env com fallback: o teste APAGA a variável.
import { describe, it, expect, afterEach } from 'vitest'
import { localSupabaseUrl, LOCAL_SUPABASE_URL_DEFAULT } from '../helpers/db-skip'

describe('localSupabaseUrl', () => {
  const saved = process.env.NEXT_PUBLIC_SUPABASE_URL
  afterEach(() => {
    if (saved === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved
  })

  it('sem a variável, vale o padrão do supabase start (54321)', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    expect(localSupabaseUrl()).toBe('http://127.0.0.1:54321')
    expect(LOCAL_SUPABASE_URL_DEFAULT).toBe('http://127.0.0.1:54321')
  })
  it('variável vazia também cai no padrão', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    expect(localSupabaseUrl()).toBe('http://127.0.0.1:54321')
  })
  it('com a variável, vale a variável (banco de outra porta)', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54421'
    expect(localSupabaseUrl()).toBe('http://127.0.0.1:54421')
  })
  it('aceita um env explícito (sem tocar process.env)', () => {
    expect(localSupabaseUrl({ NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9' })).toBe('http://127.0.0.1:9')
    expect(localSupabaseUrl({})).toBe('http://127.0.0.1:54321')
  })
})
