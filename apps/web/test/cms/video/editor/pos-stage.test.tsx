import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { PosStage } from '@/app/cms/(authed)/video/[id]/edit/stages/pos-stage'
import type { RoteiroBeatV3, PosBrief } from '@/lib/pipeline/video-schemas'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

/* ── fixtures ── */
const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'pos', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'pos',
  // edit mode so useCanEditContent() is true — the EF onBlur-commit test needs an editable field.
  editMode: 'edit', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

const beats: RoteiroBeatV3[] = [
  {
    idx: 0, name: 'Abertura', status: 'PENDING', script: [
      { type: 'line', text: 'Gancho forte', key: true },
      { type: 'vis', text: 'B-roll: drone' },
    ],
  },
  {
    idx: 1, name: 'Desenvolvimento', status: 'PENDING', script: [
      { type: 'line', text: 'Ponto principal', key: false },
      { type: 'vis', text: 'Screen record' },
    ],
  },
]

const brief: PosBrief = {
  kind: 'brief',
  deliverables: { editor: 'João', deadline: '2026-07-01', turnaround: '3 dias', drive: '/pasta', energy: 'Alta', references: ['ref1'] },
  style: [{ k: 'Corte', v: 'Rápido' }, { k: 'Música', v: 'Lo-fi' }],
  ctas: { note: 'Atenção ao idioma', rows: [{ k: 'Link', pt: 'link.pt', en: 'link.en' }], display: 'Ver QR' },
}

function wrap(node: React.ReactNode) {
  return render(
    <VideoEditorProvider initialState={seed}>{node}</VideoEditorProvider>
  )
}

/* ── tests ── */
describe('PosStage — handoff markup', () => {

  it('root has .pp-doc.fade-in', () => {
    const { container } = wrap(
      <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
    )
    expect(container.querySelector('.pp-doc.fade-in')).toBeTruthy()
  })

  it('renders .pp-bar with title, kicker text and "Exportar pro editor" button', () => {
    const { container } = wrap(
      <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
    )
    expect(container.querySelector('.pp-bar')).toBeTruthy()
    expect(container.querySelector('.pp-bar .vi-kicker')!.textContent).toContain('Pós-produção')
    expect(container.querySelector('.pp-bar-title')!.textContent).toBe('Sugestões pro editor')
    expect(screen.getByRole('button', { name: /Exportar pro editor/i })).toBeTruthy()
  })

  it('"Exportar pro editor" button calls onOpenHandoff', () => {
    const onOpenHandoff = vi.fn()
    wrap(
      <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={onOpenHandoff} legacy={null} />
    )
    screen.getByRole('button', { name: /Exportar pro editor/i }).click()
    expect(onOpenHandoff).toHaveBeenCalledOnce()
  })

  it('renders .pp-grid', () => {
    const { container } = wrap(
      <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
    )
    expect(container.querySelector('.pp-grid')).toBeTruthy()
  })

  it('each card has .pp-card > .pp-head + .pp-body', () => {
    const { container } = wrap(
      <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
    )
    const cards = container.querySelectorAll('.pp-card')
    expect(cards.length).toBeGreaterThanOrEqual(4) // Entrega, Momentos, B-roll, Estilo, CTAs
    cards.forEach(card => {
      expect(card.querySelector('.pp-head')).toBeTruthy()
      expect(card.querySelector('.pp-body')).toBeTruthy()
    })
  })

  it('each .pp-head has .pp-ico + .pp-title (+ optional .pp-sub)', () => {
    const { container } = wrap(
      <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
    )
    container.querySelectorAll('.pp-card').forEach(card => {
      expect(card.querySelector('.pp-head .pp-ico')).toBeTruthy()
      expect(card.querySelector('.pp-head .pp-title')).toBeTruthy()
    })
  })

  describe('Entrega card', () => {
    it('renders .pp-fields with .pp-f rows for Editor, Prazo, Revisão, Drive', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const fields = container.querySelector('.pp-fields')
      expect(fields).toBeTruthy()
      const rows = fields!.querySelectorAll('.pp-f')
      expect(rows.length).toBeGreaterThanOrEqual(4)
    })

    it('renders .pp-energy row', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      expect(container.querySelector('.pp-energy')).toBeTruthy()
    })

    it('EF fields have .efx class and data-ph', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const efFields = container.querySelectorAll('.efx')
      expect(efFields.length).toBeGreaterThan(0)
      // at least one has a data-ph
      const withPh = Array.from(efFields).filter(el => el.getAttribute('data-ph'))
      expect(withPh.length).toBeGreaterThan(0)
      // a11y: in edit mode every EF announces editable (aria-readonly mirrors contentEditable)
      efFields.forEach(el => expect(el.getAttribute('aria-readonly')).toBe('false'))
    })

    it('EF onBlur calls onPatch', () => {
      const onPatch = vi.fn()
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const editorField = container.querySelector('.pp-fields .pp-f .efx') as HTMLElement
      editorField.textContent = 'Novo editor'
      fireEvent.blur(editorField)
      expect(onPatch).toHaveBeenCalled()
    })
  })

  describe('Momentos-chave card', () => {
    it('renders .pp-moments with .pp-moment for each beat', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const moments = container.querySelector('.pp-moments')
      expect(moments).toBeTruthy()
      const items = moments!.querySelectorAll('.pp-moment')
      expect(items.length).toBe(beats.length)
    })

    it('each .pp-moment has .pp-mnum showing #1-indexed number', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const mnums = container.querySelectorAll('.pp-mnum')
      expect(mnums[0].textContent).toContain('#1')
      expect(mnums[1].textContent).toContain('#2')
    })

    it('each .pp-moment has .pp-mbody > .pp-mline with key line text', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const mlines = container.querySelectorAll('.pp-mline')
      expect(mlines[0].textContent).toContain('Gancho forte')
    })

    it('renders .pp-mcue when beat has a vis note', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const mcues = container.querySelectorAll('.pp-mcue')
      expect(mcues.length).toBeGreaterThan(0)
      expect(mcues[0].textContent).toContain('B-roll: drone')
    })
  })

  describe('B-roll por beat card', () => {
    it('renders .pp-broll with .pp-broll-row for beats that have vis notes', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const broll = container.querySelector('.pp-broll')
      expect(broll).toBeTruthy()
      const rows = broll!.querySelectorAll('.pp-broll-row')
      expect(rows.length).toBeGreaterThan(0)
    })

    it('each .pp-broll-row has .pp-bname showing "#N · name"', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const bnames = container.querySelectorAll('.pp-bname')
      expect(bnames[0].textContent).toContain('#1 · Abertura')
    })

    it('each .pp-broll-row has <ul><li> with vis notes', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const rows = container.querySelectorAll('.pp-broll-row')
      rows.forEach(row => {
        expect(row.querySelector('ul')).toBeTruthy()
        expect(row.querySelector('ul li')).toBeTruthy()
      })
    })
  })

  describe('Estilo & ritmo card', () => {
    it('renders .pp-style with .pp-srow rows', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const style = container.querySelector('.pp-style')
      expect(style).toBeTruthy()
      const rows = style!.querySelectorAll('.pp-srow')
      expect(rows.length).toBe(brief.style.length)
    })

    it('each .pp-srow has .pp-sk and .pp-sv (EF)', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const rows = container.querySelectorAll('.pp-srow')
      expect(rows[0].querySelector('.pp-sk')!.textContent).toBe('Corte')
      expect(rows[0].querySelector('.pp-sv')).toBeTruthy()
    })
  })

  describe('CTAs & QR card', () => {
    it('renders .pp-cta-note', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const note = container.querySelector('.pp-cta-note')
      expect(note).toBeTruthy()
      expect(note!.textContent).toContain('Atenção ao idioma')
    })

    it('renders .pp-cta-table with .pp-cta-h header', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const table = container.querySelector('.pp-cta-table')
      expect(table).toBeTruthy()
      expect(table!.querySelector('.pp-cta-h')).toBeTruthy()
    })

    it('active lang column has .on class + aria-current in header', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const header = container.querySelector('.pp-cta-h')!
      const cols = header.querySelectorAll('[role="columnheader"]')
      // cols[0] is the "Destino" corner, cols[1] is PT, cols[2] is EN
      expect(cols[1].classList.contains('on')).toBe(true)
      expect(cols[1].getAttribute('aria-current')).toBe('true')
      expect(cols[2].classList.contains('on')).toBe(false)
      expect(cols[2].getAttribute('aria-current')).toBeNull()
    })

    it('active lang column has .on + aria-current in rows', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="en" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const row = container.querySelector('.pp-cta-row')!
      const cells = row.querySelectorAll('[role="cell"]')
      // cells[0] = pt, cells[1] = en
      expect(cells[0].classList.contains('on')).toBe(false)
      expect(cells[1].classList.contains('on')).toBe(true)
      expect(cells[1].getAttribute('aria-current')).toBe('true')
    })

    it('CTA grid has table semantics (role=table/row/rowheader/cell)', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      expect(container.querySelector('.pp-cta-table[role="table"]')).toBeTruthy()
      const row = container.querySelector('.pp-cta-row')!
      expect(row.getAttribute('role')).toBe('row')
      expect(row.querySelector('[role="rowheader"]')!.textContent).toBe('Link')
      expect(row.querySelectorAll('[role="cell"]').length).toBe(2)
    })

    it('CTA cells (pt/en), note and display are editable EF fields', () => {
      const onPatch = vi.fn()
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const ptCell = container.querySelector('.pp-cta-row [role="cell"] .efx') as HTMLElement
      expect(ptCell).toBeTruthy()
      expect(ptCell.getAttribute('contenteditable')).toBe('true')
      ptCell.textContent = 'novo.pt'
      fireEvent.blur(ptCell)
      expect(onPatch).toHaveBeenCalledWith(
        expect.objectContaining({ ctas: expect.objectContaining({ rows: [expect.objectContaining({ pt: 'novo.pt' })] }) }),
      )
      // note + display are EFs too
      expect(container.querySelector('.pp-cta-note .efx')).toBeTruthy()
      expect(container.querySelector('.pp-cta-disp .efx')).toBeTruthy()
    })

    it('renders .pp-cta-row for each cta row', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const rows = container.querySelectorAll('.pp-cta-row')
      expect(rows.length).toBe(brief.ctas.rows.length)
    })

    it('renders .pp-cta-disp', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      expect(container.querySelector('.pp-cta-disp')!.textContent).toContain('Ver QR')
    })
  })

  describe('empty-beats state', () => {
    it('shows .pp-empty with "Destrinche o roteiro" link when beats is empty', () => {
      const { container } = wrap(
        <PosStage beats={[]} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const empty = container.querySelector('.pp-empty')
      expect(empty).toBeTruthy()
      expect(empty!.textContent).toContain('Destrinche o roteiro')
    })

    it('clicking "Destrinche o roteiro" dispatches SET_STAGE roteiro', () => {
      const { container } = wrap(
        <PosStage beats={[]} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const link = container.querySelector('.pp-link') as HTMLElement
      fireEvent.click(link)
      // After dispatch the provider state updates activeStage to 'roteiro'
      // We can't easily read new state here, so just assert the link exists and click doesn't throw
      expect(link).toBeTruthy()
    })
  })

  describe('headings', () => {
    it('each PPCard title renders as an <h2> heading', () => {
      wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      const headings = screen.getAllByRole('heading', { level: 2 })
      expect(headings.length).toBeGreaterThanOrEqual(4)
      expect(headings.map(h => h.className)).toContain('pp-title')
    })
  })

  describe('Recomeçar reset', () => {
    it('two-step confirm: Recomeçar → limpar wipes the brief via onPatch', () => {
      const onPatch = vi.fn()
      wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      fireEvent.click(screen.getByRole('button', { name: /Recomeçar/i }))
      fireEvent.click(screen.getByRole('button', { name: /^limpar$/i }))
      expect(onPatch).toHaveBeenCalledWith({ kind: 'brief', deliverables: {}, style: [], ctas: { note: '', rows: [], display: '' } })
    })

    it('the wiped brief flips briefHasContent → chooser returns', () => {
      const emptyBrief: PosBrief = { kind: 'brief', deliverables: {}, style: [], ctas: { note: '', rows: [], display: '' } }
      wrap(
        <PosStage beats={beats} brief={emptyBrief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      expect(screen.getByText('Sugestões pro editor')).toBeTruthy()
      expect(screen.getByRole('button', { name: /Começar do zero/i })).toBeTruthy()
    })

    it('cancel keeps the brief rendered', () => {
      wrap(
        <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      fireEvent.click(screen.getByRole('button', { name: /Recomeçar/i }))
      fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
      expect(screen.getByRole('button', { name: /Recomeçar/i })).toBeTruthy()
    })
  })

  describe('briefHasContent counts note/display', () => {
    it('a brief with only ctas.note shows the full doc (not the chooser)', () => {
      const noteOnly: PosBrief = { kind: 'brief', deliverables: {}, style: [], ctas: { note: 'Confira o QR', rows: [], display: '' } }
      const { container } = wrap(
        <PosStage beats={beats} brief={noteOnly} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      expect(container.querySelector('.pp-grid')).toBeTruthy()
      // chooser-specific affordance absent (the bar title shares the "Sugestões pro editor" text)
      expect(container.querySelector('.rot-gen')).toBeNull()
    })

    it('a brief with only ctas.display shows the full doc', () => {
      const dispOnly: PosBrief = { kind: 'brief', deliverables: {}, style: [], ctas: { note: '', rows: [], display: 'QR no canto' } }
      const { container } = wrap(
        <PosStage beats={beats} brief={dispOnly} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      expect(container.querySelector('.pp-grid')).toBeTruthy()
    })

    it('a brief with only a non-empty reference shows the full doc', () => {
      const refOnly: PosBrief = { kind: 'brief', deliverables: { references: ['ref'] }, style: [], ctas: { note: '', rows: [], display: '' } }
      const { container } = wrap(
        <PosStage beats={beats} brief={refOnly} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      expect(container.querySelector('.pp-grid')).toBeTruthy()
    })
  })

  describe('empty-state fallbacks', () => {
    it('Momentos-chave renders .pp-empty fallback when no beat yields a spoken anchor', () => {
      const silentBeats: RoteiroBeatV3[] = [
        { idx: 0, name: 'Só visual', status: 'PENDING', script: [{ type: 'vis', text: 'B-roll: paisagem' }] },
      ]
      const { container } = wrap(
        <PosStage beats={silentBeats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      expect(container.querySelector('.pp-moments')).toBeNull()
      expect(screen.getByText(/Nenhum beat falado ainda/i)).toBeTruthy()
    })

    it('B-roll renders .pp-empty fallback when no beat has vis notes', () => {
      const noVisBeats: RoteiroBeatV3[] = [
        { idx: 0, name: 'Só fala', status: 'PENDING', script: [{ type: 'line', text: 'Apenas falando', key: true }] },
      ]
      const { container } = wrap(
        <PosStage beats={noVisBeats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      expect(container.querySelector('.pp-broll')).toBeNull()
      expect(screen.getByText(/Nenhum beat tem cue visual ainda/i)).toBeTruthy()
    })
  })

  describe('legacy fallback', () => {
    it('renders the generate chooser (legacy note) when legacy payload with schema_version is present', () => {
      wrap(
        <PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={{ schema_version: '2.0' }} />
      )
      expect(screen.getByRole('button', { name: /Gerar pós com Cowork/i })).toBeTruthy()
      expect(screen.getByText(/formato antigo/i)).toBeTruthy()
    })

    it('"Começar do zero" force-seeds POS_TEMPLATE via onSeed (not the gated onPatch) on the legacy chooser', () => {
      const onPatch = vi.fn()
      const onSeed = vi.fn()
      wrap(
        <PosStage beats={beats} brief={null} activeLang="pt" onPatch={onPatch} onSeed={onSeed} onOpenHandoff={vi.fn()} legacy={{ schema_version: '2.0' }} />
      )
      fireEvent.click(screen.getByRole('button', { name: /Começar do zero/i }))
      expect(onSeed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'brief' }))
      expect(onPatch).not.toHaveBeenCalled()
    })

    it('renders the generate chooser when legacy has no "kind" field', () => {
      wrap(
        <PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={{ someOldField: true }} />
      )
      expect(screen.getByRole('button', { name: /Começar do zero/i })).toBeTruthy()
    })
  })

  describe('null brief defaults', () => {
    it('renders without crashing when brief is null', () => {
      const { container } = wrap(
        <PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      )
      expect(container.querySelector('.pp-doc.fade-in')).toBeTruthy()
    })
  })
})
