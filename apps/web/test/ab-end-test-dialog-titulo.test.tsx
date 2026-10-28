// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import { AbEndTestDialog } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-end-test-dialog'
import { dadosDoDialogoEncerrar } from '@/app/cms/(authed)/youtube/ab-lab/_components/encerrar-props'

afterEach(() => cleanup())

const variantDb = [
  { id: 'v1', label: 'A' as const, is_original: true, blob_url: 'https://x/orig.jpg', title_text: 'Orig', dimensions: '1280x720' },
  { id: 'v2', label: 'B' as const, is_original: false, blob_url: null, title_text: 'Título B', dimensions: null },
]
const base = { videoTitle: 'Vídeo', activeNow: 'A' as const, noArAgora: { label: 'A' as const, desde: '2026-10-07T08:00:00Z' }, variantDb }

function abrir(flag: 'title' | 'thumbnail', db = variantDb) {
  const d = dadosDoDialogoEncerrar({ ...base, variantDb: db, flag })
  render(<AbEndTestDialog aberto onFechar={vi.fn()} testeNome="T" {...d} podeDeixarVariante encerrar={vi.fn()} seqVisto={0} freio={{ tipo: 'faltam', texto: 'Faltam 8 dias dos 14. Encerrar agora usa só os 5 dias já medidos.' }} />)
  return d
}

describe('Encerrar em teste só de título: miniatura', () => {
  it('B mostra o mesmo src de A e a nota aparece; "Sem imagem" não aparece', () => {
    const d = abrir('title')
    expect(d.miniaturaNaoMuda).toBe(true)
    expect(d.opcoes.map(o => o.miniatura)).toEqual(['https://x/orig.jpg', 'https://x/orig.jpg'])
    expect(document.querySelectorAll('img')).toHaveLength(2)
    expect([...document.querySelectorAll('img')].every(i => i.getAttribute('src') === 'https://x/orig.jpg')).toBe(true)
    expect(screen.getAllByText('miniatura não muda')).toHaveLength(2)
    expect(screen.queryByText('Sem imagem')).toBeNull()
  })

  it('teste de miniatura: nada muda (B sem imagem continua "Sem imagem", sem nota)', () => {
    const d = abrir('thumbnail')
    expect(d.miniaturaNaoMuda).toBe(false)
    expect(d.opcoes.map(o => o.miniatura)).toEqual(['https://x/orig.jpg', null])
    expect(screen.queryByText('miniatura não muda')).toBeNull()
    expect(screen.getAllByText('Sem imagem')).toHaveLength(1)
  })

  it('sem flag (chamada antiga): comportamento de antes', () => {
    const d = dadosDoDialogoEncerrar(base)
    expect(d.miniaturaNaoMuda).toBe(false)
  })
})
