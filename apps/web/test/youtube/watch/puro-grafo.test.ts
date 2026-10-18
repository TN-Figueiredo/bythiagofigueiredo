// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('sharp', () => { throw new Error('sharp carregado pela porta pura') })
vi.mock('@vercel/blob', () => { throw new Error('@vercel/blob carregado pela porta pura') })
vi.mock('@supabase/supabase-js', () => { throw new Error('@supabase/supabase-js carregado pela porta pura') })

describe('A13 porta pura', () => {
  it('watch/puro carrega sem sharp, @vercel/blob nem supabase e exporta só as três funções', async () => {
    const m = await import('@/lib/youtube/watch/puro')
    expect(Object.keys(m).sort()).toEqual(['extrairDaWatch', 'leiturasDoBanco', 'paraLinhas'])
  })
})
