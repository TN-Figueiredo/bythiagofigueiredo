import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { toast } from 'sonner'
import { VideoEditorProvider } from '@/app/cms/(authed)/video/[id]/edit/context'
import { PosStage } from '@/app/cms/(authed)/video/[id]/edit/stages/pos-stage'
import { handoffBeatRows } from '@/lib/pipeline/handoff-sheet-data'
import type { RoteiroBeatV3, PosBrief } from '@/lib/pipeline/video-schemas'
import type { VideoEditorState } from '@/app/cms/(authed)/video/[id]/edit/types'

vi.mock('sonner', () => ({ toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() } }))

const seed: VideoEditorState = {
  itemId: 'vid-1', code: 'V-A07', siteId: 'site-1', stage: 'pos', version: 1,
  primaryLang: 'pt', activeLang: 'pt', activeStage: 'pos', focus: false, notes: false,
  recordingOpen: false, handoffOpen: false, coworkOpen: false,
}

const beats: RoteiroBeatV3[] = [
  { idx: 0, name: 'Abertura', status: 'PENDING', script: [
    { type: 'line', text: 'Gancho forte', key: true },
    { type: 'vis', text: 'B-roll: drone' },
  ] },
]
// A "started" brief (has style rows) → renders the full Pós doc (not the generate chooser).
const brief = { kind: 'brief' as const, ctas: { note: '', rows: [], display: '' }, style: [{ k: 'Ritmo', v: 'rápido' }], deliverables: {} }
const editSeed = { ...seed, editMode: 'edit' } as VideoEditorState

function wrap(node: React.ReactNode) {
  return render(<VideoEditorProvider initialState={seed}>{node}</VideoEditorProvider>)
}

describe('PosStage', () => {
  it('derives Momentos-chave (#1) and B-roll por beat (#1) from the roteiro (not stored)', () => {
    wrap(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
    expect(screen.getByText(/Gancho forte/)).toBeInTheDocument()
    expect(screen.getAllByText('B-roll: drone').length).toBeGreaterThan(0)
    expect(screen.getAllByText('#1', { exact: false }).length).toBeGreaterThan(0)
  })

  it('shows the no-beats empty state when roteiro has no beats', () => {
    wrap(<PosStage beats={[]} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
    expect(screen.getByText(/Destrinche o roteiro/i)).toBeInTheDocument()
  })

  it('renders the generate chooser (with a legacy note) when a legacy payload is present', () => {
    wrap(<PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={{ schema_version: '2.0' }} />)
    expect(screen.getByRole('button', { name: /Gerar pós com Cowork/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Começar do zero/i })).toBeInTheDocument()
    expect(screen.getByText(/formato antigo/i)).toBeInTheDocument()
  })

  it('"Exportar pro editor" opens the HandoffSheet', () => {
    const onOpenHandoff = vi.fn()
    wrap(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={onOpenHandoff} legacy={null} />)
    screen.getByRole('button', { name: /Exportar pro editor/i }).click()
    expect(onOpenHandoff).toHaveBeenCalled()
  })

  it('shows the generate/start chooser (not empty cards) when the brief is empty', () => {
    render(
      <VideoEditorProvider initialState={editSeed}>
        <PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
      </VideoEditorProvider>,
    )
    expect(screen.getByText('Instruções pro editor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Gerar pós com Cowork/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Começar do zero/i })).toBeInTheDocument()
  })

  it('"Começar do zero" force-seeds a template brief (kind: brief) via onSeed', () => {
    const onSeed = vi.fn()
    render(
      <VideoEditorProvider initialState={editSeed}>
        <PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={onSeed} onOpenHandoff={vi.fn()} legacy={null} />
      </VideoEditorProvider>,
    )
    screen.getByRole('button', { name: /Começar do zero/i }).click()
    expect(onSeed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'brief' }))
  })

  describe('per-beat overrides (Momentos-chave / B-roll editable in the Pós)', () => {
    const briefWithOv = {
      ...brief,
      overrides: { i0: { line: 'Gancho reescrito na Pós', cue: 'Cue editado', broll: ['B-roll: estúdio'] } },
    }
    const lineOnlyOv = { ...brief, overrides: { i0: { line: 'Gancho reescrito na Pós' } } }

    function wrapEdit(node: React.ReactNode) {
      return render(<VideoEditorProvider initialState={editSeed}>{node}</VideoEditorProvider>)
    }

    it('an override SHADOWS the derived line/cue/b-roll on screen (derived hidden)', () => {
      wrap(<PosStage beats={beats} brief={briefWithOv} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
      expect(screen.getByText(/Gancho reescrito na Pós/)).toBeInTheDocument()
      expect(screen.queryByText(/Gancho forte/)).not.toBeInTheDocument()
      expect(screen.getByText('Cue editado')).toBeInTheDocument()
      expect(screen.getByText('B-roll: estúdio')).toBeInTheDocument()
      expect(screen.queryByText('B-roll: drone')).not.toBeInTheDocument()
    })

    it('overridden values carry the subtle pp-ov affordance; derived ones do not', () => {
      wrap(<PosStage beats={beats} brief={lineOnlyOv} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
      const line = screen.getByRole('textbox', { name: 'Frase-âncora' })
      expect(line.classList.contains('pp-ov')).toBe(true)
      // cue is NOT overridden (still derives from the vis note) → no pp-ov on it
      const cue = screen.getByRole('textbox', { name: 'Cue visual' })
      expect(cue.classList.contains('pp-ov')).toBe(false)
    })

    it('editing the moment line writes a per-beat override via onPatch', () => {
      const onPatch = vi.fn()
      wrapEdit(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
      const ef = screen.getByRole('textbox', { name: 'Frase-âncora' })
      ef.textContent = 'Gancho novo'
      fireEvent.blur(ef)
      expect(onPatch).toHaveBeenCalledWith({ overrides: { i0: { line: 'Gancho novo' } } })
    })

    it('editing the visual cue writes the cue field without touching other fields', () => {
      const onPatch = vi.fn()
      wrapEdit(<PosStage beats={beats} brief={briefWithOv} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
      const ef = screen.getByRole('textbox', { name: 'Cue visual' })
      ef.textContent = 'Drone do alto'
      fireEvent.blur(ef)
      expect(onPatch).toHaveBeenCalledWith({
        overrides: { i0: { line: 'Gancho reescrito na Pós', broll: ['B-roll: estúdio'], cue: 'Drone do alto' } },
      })
    })

    it('clearing an overridden line (empty after trim) DELETES the field — and the key when empty', () => {
      const onPatch = vi.fn()
      wrapEdit(<PosStage beats={beats} brief={lineOnlyOv} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
      const ef = screen.getByRole('textbox', { name: 'Frase-âncora' })
      ef.textContent = '   '
      fireEvent.blur(ef)
      expect(onPatch).toHaveBeenCalledWith({ overrides: {} })
    })

    it('editing a b-roll item stores the full effective list as override.broll', () => {
      const onPatch = vi.fn()
      wrapEdit(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
      const item = screen.getByRole('textbox', { name: 'Item de b-roll' })
      item.textContent = 'B-roll: bastidores'
      fireEvent.blur(item)
      expect(onPatch).toHaveBeenCalledWith({ overrides: { i0: { broll: ['B-roll: bastidores'] } } })
    })

    it('clearing the only overridden b-roll item deletes the key (falls back to derived)', () => {
      const onPatch = vi.fn()
      const brollOnly = { ...brief, overrides: { i0: { broll: ['B-roll: estúdio'] } } }
      wrapEdit(<PosStage beats={beats} brief={brollOnly} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
      const item = screen.getByRole('textbox', { name: 'Item de b-roll' })
      item.textContent = ''
      fireEvent.blur(item)
      expect(onPatch).toHaveBeenCalledWith({ overrides: {} })
    })

    it('VIEW mode: override fields are read-only (aria-readonly, blur never commits)', () => {
      const onPatch = vi.fn()
      wrap(<PosStage beats={beats} brief={briefWithOv} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
      const ef = screen.getByRole('textbox', { name: 'Frase-âncora' })
      expect(ef).toHaveAttribute('aria-readonly', 'true')
      ef.textContent = 'tentativa'
      fireEvent.blur(ef)
      expect(onPatch).not.toHaveBeenCalled()
    })
  })

  describe('unified beat numbering (screen #N ≡ printed handoff #N)', () => {
    // A beat set where the OLD per-card schemes diverged:
    //  - 'KIT' (empty)        → dropped from the projection (consumes no number)
    //  - 'Abertura' (line+vis) → row #1
    //  - 'Montagem' (vis-only) → row #2  (old B-roll raw index: #3)
    //  - 'Fechamento' (line)   → row #3  (old Momentos contiguous re-count: #2)
    const divergeBeats: RoteiroBeatV3[] = [
      { idx: 0, name: 'KIT', status: 'PENDING', script: [] },
      { idx: 1, name: 'Abertura', status: 'PENDING', script: [
        { type: 'line', text: 'Gancho forte', key: true },
        { type: 'vis', text: 'B-roll: drone' },
      ] },
      { idx: 2, name: 'Montagem', status: 'PENDING', script: [{ type: 'vis', text: 'B-roll: bancada' }] },
      { idx: 3, name: 'Fechamento', status: 'PENDING', script: [{ type: 'line', text: 'Chamada final', key: true }] },
    ]

    it('Momentos and B-roll both show the row displayNum from the handoff projection', () => {
      const { container } = wrap(
        <PosStage beats={divergeBeats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />,
      )
      // Momentos: Fechamento keeps its projection number #3 — NOT a contiguous re-count (#2)
      const mnums = Array.from(container.querySelectorAll('.pp-mnum')).map((e) => e.textContent)
      expect(mnums).toEqual(['#1', '#3'])
      // B-roll: projection numbers — NOT raw roteiro indices (#2/#3)
      const bnames = Array.from(container.querySelectorAll('.pp-bname')).map((e) => e.textContent)
      expect(bnames).toEqual(['#1 · Abertura', '#2 · Montagem'])
      // ...and the printed handoff projection agrees with both cards
      const rows = handoffBeatRows(divergeBeats)
      expect(rows.map((r) => [r.displayNum, r.name])).toEqual([[1, 'Abertura'], [2, 'Montagem'], [3, 'Fechamento']])
    })

    it('EF edits on projected rows write overrides keyed by the SOURCE beat (not the row position)', () => {
      const onPatch = vi.fn()
      render(
        <VideoEditorProvider initialState={editSeed}>
          <PosStage beats={divergeBeats} brief={brief} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
        </VideoEditorProvider>,
      )
      const lines = screen.getAllByRole('textbox', { name: 'Frase-âncora' })
      // second moment = 'Fechamento', RAW beat index 3 → override key i3 (not i1/i2)
      lines[1].textContent = 'Final novo'
      fireEvent.blur(lines[1])
      expect(onPatch).toHaveBeenCalledWith({ overrides: { i3: { line: 'Final novo' } } })
    })
  })

  describe('view-mode honesty (no editable costume in view)', () => {
    it('VIEW: bar copy says read-only; card subs drop the editable claims', () => {
      wrap(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
      expect(screen.getByText(/Somente leitura — ative o lápis pra editar/)).toBeInTheDocument()
      expect(screen.queryByText(/Tudo editável/)).not.toBeInTheDocument()
      expect(screen.queryByText(/clique para editar/)).not.toBeInTheDocument()
      expect(screen.queryByText(/— editável/)).not.toBeInTheDocument()
    })

    it('EDIT: bar copy claims editability and the Entrega sub invites the click', () => {
      render(
        <VideoEditorProvider initialState={editSeed}>
          <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
        </VideoEditorProvider>,
      )
      expect(screen.getByText(/Tudo editável · ajuste por vídeo/)).toBeInTheDocument()
      expect(screen.getByText(/o combinado · clique para editar/)).toBeInTheDocument()
      expect(screen.queryByText(/Somente leitura/)).not.toBeInTheDocument()
    })

    it('VIEW: an empty EF renders a plain "—" with NO placeholder ghost (data-ph dropped)', () => {
      // brief.deliverables is empty → the always-rendered Escopo EF is empty
      wrap(<PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />)
      const escopo = screen.getByRole('textbox', { name: /corte principal/ })
      expect(escopo).not.toHaveAttribute('data-ph')
      expect(escopo.textContent).toBe('—')
    })

    it('EDIT: the same empty EF keeps the placeholder ghost (data-ph) and stays empty', () => {
      render(
        <VideoEditorProvider initialState={editSeed}>
          <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={vi.fn()} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
        </VideoEditorProvider>,
      )
      const escopo = screen.getByRole('textbox', { name: /corte principal/ })
      expect(escopo.getAttribute('data-ph')).toMatch(/corte principal/)
      expect(escopo.textContent).toBe('')
    })
  })

  describe('POS_TEMPLATE per language', () => {
    function seedOn(lang: 'pt' | 'en') {
      const onSeed = vi.fn()
      render(
        <VideoEditorProvider initialState={{ ...editSeed, activeLang: lang }}>
          <PosStage beats={beats} brief={null} activeLang={lang} onPatch={vi.fn()} onSeed={onSeed} onOpenHandoff={vi.fn()} legacy={null} />
        </VideoEditorProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: /Começar do zero/i }))
      return onSeed.mock.calls[0][0] as PosBrief
    }

    it('"Começar do zero" on the EN version seeds EN style keys + EN CTA copy', () => {
      const seeded = seedOn('en')
      const keys = (seeded.style ?? []).map((s) => s.k)
      expect(keys).toContain('Music')
      expect(keys).toContain('On-screen text')
      expect(keys).not.toContain('Música')
      expect(seeded.ctas?.note).toMatch(/DIFFERENT per language/)
      expect(seeded.ctas?.display).toMatch(/bottom-right corner/)
    })

    it('"Começar do zero" on the PT version keeps the PT skeleton', () => {
      const seeded = seedOn('pt')
      const keys = (seeded.style ?? []).map((s) => s.k)
      expect(keys).toContain('Música')
      expect(keys).toContain('Texto na tela')
      expect(seeded.ctas?.note).toMatch(/DIFERENTE por idioma/)
    })
  })

  describe('EF keyboard semantics', () => {
    function editField() {
      const onPatch = vi.fn()
      render(
        <VideoEditorProvider initialState={editSeed}>
          <PosStage beats={beats} brief={brief} activeLang="pt" onPatch={onPatch} onSeed={vi.fn()} onOpenHandoff={vi.fn()} legacy={null} />
        </VideoEditorProvider>,
      )
      return { onPatch, ef: screen.getByRole('textbox', { name: 'Frase-âncora' }) }
    }

    it('Enter prevents the newline and commits via blur', () => {
      const { onPatch, ef } = editField()
      const blurSpy = vi.spyOn(ef as HTMLElement, 'blur')
      ef.textContent = 'Gancho novo'
      const notCancelled = fireEvent.keyDown(ef, { key: 'Enter' })
      expect(notCancelled).toBe(false) // preventDefault → Enter never inserts a newline
      expect(blurSpy).toHaveBeenCalled()
      fireEvent.blur(ef) // jsdom .blur() doesn't dispatch the event — simulate the browser's
      expect(onPatch).toHaveBeenCalledWith({ overrides: { i0: { line: 'Gancho novo' } } })
    })

    it('Esc reverts to the pre-focus value and the blur does NOT commit', () => {
      const { onPatch, ef } = editField()
      fireEvent.focus(ef) // stashes 'Gancho forte'
      ef.textContent = 'edição abandonada'
      fireEvent.keyDown(ef, { key: 'Escape' })
      expect(ef.textContent).toBe('Gancho forte') // reverted in place
      fireEvent.blur(ef)
      expect(onPatch).not.toHaveBeenCalled() // Esc-revert blur skips the commit (no spurious override)
    })
  })

  describe('Recomeçar undo', () => {
    beforeEach(() => vi.mocked(toast.info).mockClear())

    it('the reset toast offers "Desfazer" (~8s) that restores the stashed brief via onSeed', () => {
      const onPatch = vi.fn()
      const onSeed = vi.fn()
      const coworkBrief: PosBrief = {
        ...brief,
        deliverables: { editor: 'João', notes: 'corte principal 10min' },
        overrides: { i0: { line: 'Linha escrita pelo Cowork' } },
      }
      render(
        <VideoEditorProvider initialState={editSeed}>
          <PosStage beats={beats} brief={coworkBrief} activeLang="pt" onPatch={onPatch} onSeed={onSeed} onOpenHandoff={vi.fn()} legacy={null} />
        </VideoEditorProvider>,
      )
      fireEvent.click(screen.getByRole('button', { name: /Recomeçar/i }))
      fireEvent.click(screen.getByRole('button', { name: /^limpar$/i }))
      // the wipe still persists immediately (incl. overrides)
      expect(onPatch).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'brief', style: [], overrides: {} }),
      )
      const opts = vi.mocked(toast.info).mock.calls[0]?.[1] as unknown as {
        duration?: number
        action?: { label: string; onClick: () => void }
      }
      expect(opts.duration).toBe(8000)
      expect(opts.action?.label).toBe('Desfazer')
      // Desfazer → the FULL pre-reset brief (incl. Cowork-written overrides) is force-restored
      opts.action?.onClick()
      expect(onSeed).toHaveBeenCalledWith(coworkBrief)
    })
  })

  it('VIEW mode: chooser actions are visible and "Começar do zero" enters edit mode + force-seeds', () => {
    const onSeed = vi.fn()
    // seed defaults to no editMode → 'view'
    render(
      <VideoEditorProvider initialState={seed}>
        <PosStage beats={beats} brief={null} activeLang="pt" onPatch={vi.fn()} onSeed={onSeed} onOpenHandoff={vi.fn()} legacy={null} />
      </VideoEditorProvider>,
    )
    expect(screen.getByRole('button', { name: /Gerar pós com Cowork/i })).toBeInTheDocument()
    const startBtn = screen.getByRole('button', { name: /Começar do zero/i })
    expect(startBtn).toBeInTheDocument()
    startBtn.click()
    expect(onSeed).toHaveBeenCalledWith(expect.objectContaining({ kind: 'brief' }))
  })
})
