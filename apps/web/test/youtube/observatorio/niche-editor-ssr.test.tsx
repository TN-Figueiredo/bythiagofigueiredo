// @vitest-environment node
/** ?nicheEditor=1 opened by URL renders the dialog on the server, where there is no document and no HTMLElement. */
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { NicheEditorDialog } from '@/app/cms/(authed)/youtube/competitors/_canais/niche-editor'

describe('NicheEditorDialog on the server', () => {
  it('renders without touching browser globals', () => {
    expect(typeof HTMLElement).toBe('undefined')
    const html = renderToString(<NicheEditorDialog rows={[{ id: 'a', name: 'Canal A', niche: 'ia' }]} onNiche={() => {}} onClose={() => {}} trap={() => {}} />)
    expect(html).toContain('Definir nicho dos canais')
    expect(html).toContain('Canal A')
  })
})
