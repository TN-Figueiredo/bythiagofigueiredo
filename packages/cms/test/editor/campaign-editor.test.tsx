import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react'
import {
  CampaignEditor,
  type CampaignEditorInitialCampaign,
  type CampaignEditorInitialTranslation,
} from '../../src/editor/campaign-editor'

const baseCampaign: CampaignEditorInitialCampaign = {
  slug: 'lead-magnet-x',
  interest: 'product',
  status: 'draft',
  scheduled_for: null,
  pdf_storage_path: null,
  brevo_list_id: null,
  brevo_template_id: null,
  form_fields: [],
}

const ptTranslation: CampaignEditorInitialTranslation = {
  locale: 'pt-BR',
  main_hook_md: 'Hook original',
  supporting_argument_md: null,
  introductory_block_md: null,
  body_content_md: null,
  form_intro_md: null,
  form_button_label: null,
  context_tag: null,
  meta_title: null,
  meta_description: null,
  og_image_url: null,
  extras: null,
}

const enTranslation: CampaignEditorInitialTranslation = {
  ...ptTranslation,
  locale: 'en',
  main_hook_md: 'English hook',
}

function installLocalStorageMock() {
  const store = new Map<string, string>()
  const mock: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    key: (i) => Array.from(store.keys())[i] ?? null,
    removeItem: (k) => {
      store.delete(k)
    },
    setItem: (k, v) => {
      store.set(k, String(v))
    },
  }
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: mock,
  })
  return mock
}

beforeEach(() => {
  installLocalStorageMock()
})

describe('CampaignEditor', () => {
  it('mounts and renders meta + translation fields', () => {
    render(
      <CampaignEditor
        campaignId="c1"
        initialCampaign={baseCampaign}
        initialTranslations={[ptTranslation]}
        locale="pt-BR"
        availableLocales={['pt-BR', 'en']}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
        autosaveDisabled
      />,
    )
    expect(screen.getByRole('textbox', { name: /^Slug$/i })).toBeTruthy()
    expect(
      screen.getByRole('textbox', { name: /Hook principal \(pt-BR\)/i }),
    ).toBeTruthy()
  })

  it('calls onSave with patch + translations payload', async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true })
    render(
      <CampaignEditor
        campaignId="c1"
        initialCampaign={baseCampaign}
        initialTranslations={[ptTranslation]}
        locale="pt-BR"
        availableLocales={['pt-BR']}
        onSave={onSave}
        autosaveDisabled
      />,
    )

    const slugInput = screen.getByRole('textbox', { name: /^Slug$/i }) as HTMLInputElement
    fireEvent.change(slugInput, { target: { value: 'updated-slug' } })

    const hook = screen.getByRole('textbox', {
      name: /Hook principal \(pt-BR\)/i,
    }) as HTMLTextAreaElement
    fireEvent.change(hook, { target: { value: 'Hook novo' } })

    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())

    const arg = onSave.mock.calls[0]![0]
    expect(arg.patch.slug).toBe('updated-slug')
    expect(arg.patch.status).toBe('draft')
    expect(Array.isArray(arg.translations)).toBe(true)
    expect(arg.translations[0]!.locale).toBe('pt-BR')
    expect(arg.translations[0]!.main_hook_md).toBe('Hook novo')
  })

  it('switches locale tabs and edits independent translation', () => {
    render(
      <CampaignEditor
        campaignId="c2"
        initialCampaign={baseCampaign}
        initialTranslations={[ptTranslation, enTranslation]}
        locale="pt-BR"
        availableLocales={['pt-BR', 'en']}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
        autosaveDisabled
      />,
    )

    // pt-BR active by default
    expect(
      (screen.getByRole('textbox', { name: /Hook principal \(pt-BR\)/i }) as HTMLTextAreaElement).value,
    ).toBe('Hook original')

    fireEvent.click(screen.getByRole('tab', { name: 'en' }))
    expect(
      (screen.getByRole('textbox', { name: /Hook principal \(en\)/i }) as HTMLTextAreaElement).value,
    ).toBe('English hook')
  })

  it('surfaces save error from onSave result', async () => {
    const onSave = vi
      .fn()
      .mockResolvedValue({ ok: false, error: 'db_error', message: 'boom' })
    render(
      <CampaignEditor
        campaignId="c3"
        initialCampaign={baseCampaign}
        initialTranslations={[ptTranslation]}
        locale="pt-BR"
        availableLocales={['pt-BR']}
        onSave={onSave}
        autosaveDisabled
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('boom')
    })
  })

  it('shows autosave restore banner when draft exists in storage', async () => {
    const draft = {
      campaign: { ...baseCampaign, slug: 'draft-slug' },
      translations: [{ ...ptTranslation, main_hook_md: 'Draft hook' }],
      activeLocale: 'pt-BR',
    }
    window.localStorage.setItem('campaign-draft:c4', JSON.stringify(draft))

    render(
      <CampaignEditor
        campaignId="c4"
        initialCampaign={baseCampaign}
        initialTranslations={[ptTranslation]}
        locale="pt-BR"
        availableLocales={['pt-BR']}
        onSave={vi.fn().mockResolvedValue({ ok: true })}
      />,
    )

    const banner = await screen.findByTestId('autosave-banner')
    expect(banner).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /restaurar/i }))
    })

    const slugInput = screen.getByRole('textbox', { name: /^Slug$/i }) as HTMLInputElement
    expect(slugInput.value).toBe('draft-slug')
    const hook = screen.getByRole('textbox', {
      name: /Hook principal \(pt-BR\)/i,
    }) as HTMLTextAreaElement
    expect(hook.value).toBe('Draft hook')
  })
})
