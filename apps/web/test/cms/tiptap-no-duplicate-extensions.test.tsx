// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { Editor } from '@tiptap/core'
import { TipTapEditor } from '@/app/cms/(authed)/_shared/editor/tiptap-editor'
import { getFullExtensions, getCompactExtensions, getBlogExtensions } from '@/app/cms/(authed)/pipeline/_components/detail/editors/pipeline-extensions'
import { getScriptExtensions } from '@/app/cms/(authed)/pipeline/_components/detail/editors/script-extensions'

// Gio, ressalva C: StarterKit 3 já traz link/underline; os avulsos geravam
// "[tiptap warn] Duplicate extension names ['link','underline']".
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function avisosDeDuplicata(spy: ReturnType<typeof vi.spyOn>) {
  return spy.mock.calls.filter((c) => String(c[0]).includes('Duplicate extension names'))
}

describe('tiptap: sem extensões duplicadas', () => {
  it('TipTapEditor (blog/newsletter) monta sem aviso e mantém o link configurado', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    let inst: Editor | null = null
    const ref = { current: null as Editor | null }
    render(<TipTapEditor content="<p><a href='https://x.com'>oi</a></p>" onChange={() => {}} onImageUpload={async () => null} editorInstanceRef={ref} />)
    await waitFor(() => expect(ref.current).not.toBeNull())
    inst = ref.current
    expect(avisosDeDuplicata(warn)).toEqual([])
    const link = inst!.extensionManager.extensions.find((e) => e.name === 'link')
    expect(link?.options.openOnClick).toBe(false)
    expect(link?.options.HTMLAttributes).toMatchObject({ rel: 'noopener noreferrer nofollow' })
    expect(inst!.extensionManager.extensions.filter((e) => e.name === 'underline')).toHaveLength(1)
  })

  const FABRICAS: Array<[string, () => import('@tiptap/react').Extensions]> = [
    ['getFullExtensions', () => getFullExtensions()],
    ['getBlogExtensions', () => getBlogExtensions()],
    ['getCompactExtensions', () => getCompactExtensions()],
    ['getScriptExtensions', () => getScriptExtensions()],
  ]
  for (const [nome, fab] of FABRICAS) {
    it(`${nome} cria o editor sem aviso de nome duplicado`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const ed = new Editor({ extensions: fab(), element: document.createElement('div') })
      expect(avisosDeDuplicata(warn)).toEqual([])
      expect(ed.extensionManager.extensions.filter((e) => e.name === 'link')).toHaveLength(1)
      ed.destroy()
    })
  }
})
