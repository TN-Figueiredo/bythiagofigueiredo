// @vitest-environment jsdom
/**
 * /cms/youtube, aba Painel: cadastro de canais e de nichos. As actions entram por props (nunca importadas pela tela).
 * Retorno imediato: cada interação é afirmada ANTES de a action resolver (a promessa fica presa) e depois, no
 * sucesso e na falha.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import type {
  AddChannelResult, CreateNicheResult, LookupChannelResult, RemovalImpact, RemovalImpactResult, RemoveChannelResult, SimpleResult,
} from '@/lib/youtube/channel-registry'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, replace: vi.fn(), push: vi.fn(), back: vi.fn() }) }))
vi.mock('next/link', () => ({ default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => <a href={href} {...rest}>{children}</a> }))
vi.mock('@/app/cms/(authed)/youtube/videos/actions', () => ({ triggerSync: vi.fn(), unpinWeeklyPick: vi.fn(), pinWeeklyPick: vi.fn() }))
vi.mock('@/app/cms/(authed)/settings/actions', () => ({ updateYouTubeChannelSettings: vi.fn() }))

import { DashboardConnected, type ChannelDashboard, type NicheView } from '@/app/cms/(authed)/youtube/dashboard-connected'

function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b })
  return { promise, resolve, reject }
}
const settle = async (fn: () => void) => { await act(async () => { fn(); await Promise.resolve(); await Promise.resolve() }) }

const channel = (over: Partial<ChannelDashboard>): ChannelDashboard => ({
  id: 'c1', locale: 'pt', handle: '@tnfigueiredo', name: 'tnFigueiredo', slug: 'tnfigueiredo', niche: 'viagem',
  subscriberCount: 3200, videoCount: 58, thumbnailUrl: null, lastSyncedAt: new Date(Date.now() - 3 * 3600e3).toISOString(), lastSyncStatus: 'completed',
  pinnedVideo: null, totalViews: 412600, totalLikes: 18300, featuredCount: 0, hiddenCount: 0, latestVideoAt: null, lastSync: null,
  scheduleLabel: null, syncEnabled: true, syncSchedules: [], rawScheduleLabel: null, ...over,
})
const TNF = channel({})
const EN = channel({ id: 'c2', locale: 'en', handle: '@thiago-figueiredo', name: 'Thiago Figueiredo', slug: 'thiago-figueiredo' })
const CORTES = channel({ id: 'c3', handle: '@cortes-tnfigueiredo', name: 'Cortes do tnFigueiredo', slug: 'cortes-tnfigueiredo', lastSyncedAt: null, videoCount: 0 })
const JOGA = channel({ id: 'c4', handle: '@tnfigueiredo-joga', name: 'tnFigueiredo Joga', slug: 'tnfigueiredo-joga', niche: null })

const VIAGEM: NicheView = { slug: 'viagem', label: 'Viagem', dark: '#5BBF8A', light: '#11692F', builtin: true, channels: 3, competitors: 12 }
const IA: NicheView = { slug: 'ia', label: 'IA', dark: '#6EA8FE', light: '#1D4ED8', builtin: true, channels: 0, competitors: 0 }
const JOGOS: NicheView = { slug: 'jogos', label: 'Jogos', dark: '#D29AE8', light: '#7B2A91', builtin: false, channels: 1, competitors: 1 }

const FOUND = {
  channelId: 'UCnew', handle: '@Viagem.BR', name: 'Thiago na Estrada', description: null, uploadsPlaylistId: 'UUnew',
  subscriberCount: 126, videoCount: 41, thumbnailUrl: null, bannerUrl: null, customUrl: null,
}
const IMPACT: RemovalImpact = {
  name: 'tnFigueiredo', slug: 'tnfigueiredo', videos: 212, comments: 48, syncLogs: 864, abTests: 3, analyses: 9, tasks: 2, notes: 14, pipelineLinks: 6, blockers: [],
}

function harness(over: { channels?: ChannelDashboard[]; niches?: NicheView[]; nichesAvailable?: boolean } = {}) {
  const fns = {
    onLookup: vi.fn(async (): Promise<LookupChannelResult> => ({ ok: true, channel: FOUND, slug: 'viagem-br' })),
    onAdd: vi.fn(async (): Promise<AddChannelResult> => ({ ok: true, id: 'c9', slug: 'viagem-br' })),
    onUpdateIdentity: vi.fn(async (): Promise<SimpleResult> => ({ ok: true })),
    onCreateNiche: vi.fn(async (): Promise<CreateNicheResult> => ({ ok: true, slug: 'jogos' })),
    onRemovalImpact: vi.fn(async (): Promise<RemovalImpactResult> => ({ ok: true, impact: IMPACT })),
    onRemove: vi.fn(async (): Promise<RemoveChannelResult> => ({ ok: true })),
  }
  const tree = (p: { channels?: ChannelDashboard[]; niches?: NicheView[] } = {}) => (
    <div data-cms-section="youtube">
      <DashboardConnected
        channels={p.channels ?? over.channels ?? [TNF, EN, CORTES]} uncategorizedCount={0}
        niches={p.niches ?? over.niches ?? [VIAGEM, IA]} nichesAvailable={over.nichesAvailable ?? true} {...fns}
      />
    </div>
  )
  const r = render(tree())
  return { ...fns, r, rerender: (p: { channels?: ChannelDashboard[]; niches?: NicheView[] }) => r.rerender(tree(p)) }
}
const card = (id: string) => document.querySelector<HTMLElement>(`[data-channel="${id}"]`)!
const pendingCards = () => [...document.querySelectorAll<HTMLElement>('[data-channel-pending]')]
const addForm = () => document.querySelector<HTMLElement>('[data-add-channel]')
const nichesBlock = () => document.querySelector<HTMLElement>('[data-niches]')!

beforeEach(() => { refresh.mockClear() })

describe('lista de canais', () => {
  it('três canais (dois no mesmo idioma e nicho): cabeçalho com a contagem, Add channel sempre à vista, chip de idioma no lugar da bandeira', () => {
    const h = harness()
    expect(screen.getByRole('heading', { name: /^Channels\s*3$/ })).toBeInTheDocument()
    expect(screen.getByText('Your own YouTube channels. Each one has a language, a niche and a slug.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add channel' })).toBeEnabled()
    expect(within(card('c1')).getByText('PT-BR')).toHaveAttribute('title', 'Português (Brasil)')
    expect(within(card('c2')).getByText('EN')).toHaveAttribute('title', 'English')
    expect(within(card('c3')).getByText('PT-BR')).toBeInTheDocument()
    expect(h.r.container.textContent).not.toMatch(/🇧🇷|🇺🇸|Schedule and sync/)
    // faixa de identidade: nicho e slug sempre visíveis
    expect(within(card('c1')).getByText('Viagem')).toBeInTheDocument()
    expect(within(card('c1')).getByText('tnfigueiredo')).toBeInTheDocument()
  })

  it('o dado não existe — zero canais: o estado vazio tem a própria ação, e os nichos continuam visíveis', async () => {
    const h = harness({ channels: [], niches: [{ ...VIAGEM, channels: 0, competitors: 0 }, IA] })
    expect(screen.getByText('No YouTube channels yet')).toBeInTheDocument()
    expect(screen.getByText('Add your first channel to sync its videos.')).toBeInTheDocument()
    expect(h.r.container.textContent).not.toMatch(/admin panel|Settings/)
    expect(within(nichesBlock()).getByText('Viagem')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add channel' }))
    expect(addForm()).not.toBeNull()
  })

  it('canal sem nicho: avisa em âmbar e diz o que acontece no Observatório', () => {
    harness({ channels: [JOGA] })
    const c = card('c4')
    expect(within(c).getByText('No niche yet')).toBeInTheDocument()
    expect(c.textContent).toContain('It shows in every Observatório niche tab until you pick one in Configurar.')
  })

  it('o dado não existe — canal sem slug (coluna ausente no banco) e com nicho que saiu da lista: o cartão abre, sem slug e sem nicho', () => {
    harness({ channels: [channel({ slug: null, niche: 'sumiu' })] })
    const c = card('c1')
    expect(within(c).getByText('No niche yet')).toBeInTheDocument()
    expect(within(c).queryByText('Slug')).toBeNull()
  })
})

describe('Add channel', () => {
  const open = async (h: ReturnType<typeof harness>) => {
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Add channel' }))
    return { user, form: addForm()! }
  }

  it('abre na página; Add channel do formulário só habilita depois do lookup', async () => {
    const h = harness()
    const { form } = await open(h)
    expect(within(form).getByLabelText('Handle or URL')).toHaveAttribute('placeholder', '@handle or youtube.com/@handle')
    expect(within(form).getByRole('button', { name: 'Add channel' })).toBeDisabled()
    expect(within(form).getByRole('button', { name: 'Lookup' })).toBeDisabled()
  })

  it('Lookup: estado de busca imediato no botão e no campo, antes de a action resolver; depois, o que o lookup trouxe', async () => {
    const h = harness()
    const d = deferred<LookupChannelResult>()
    h.onLookup.mockReturnValueOnce(d.promise)
    const { user, form } = await open(h)
    await user.type(within(form).getByLabelText('Handle or URL'), '@Viagem.BR')
    await user.click(within(form).getByRole('button', { name: 'Lookup' }))
    // ANTES de resolver
    const btn = within(form).getByRole('button', { name: 'Lookup' })
    expect(btn).toBeDisabled()
    expect(btn).toHaveAttribute('aria-busy', 'true')
    expect(within(form).getByLabelText('Handle or URL')).toHaveAttribute('aria-busy', 'true')
    expect(form.querySelector('[data-lookup-preview]')).toBeNull()
    expect(h.onLookup).toHaveBeenCalledWith({ handleOrUrl: '@Viagem.BR' })
    await settle(() => d.resolve({ ok: true, channel: FOUND, slug: 'viagem-br' }))
    expect(within(form).getByRole('button', { name: 'Lookup' })).not.toHaveAttribute('aria-busy')
    const preview = form.querySelector<HTMLElement>('[data-lookup-preview]')!
    expect(preview.textContent).toContain('Thiago na Estrada')
    expect(preview.textContent).toContain('@Viagem.BR · 126 subscribers · 41 videos')
  })

  it('o idioma é um seletor comum com TODOS os idiomas (mesmo os já usados), o nicho lista os do site e "No niche yet", o slug vem do banco e é editável', async () => {
    const h = harness({ niches: [VIAGEM, IA, JOGOS] })
    const { user, form } = await open(h)
    await user.type(within(form).getByLabelText('Handle or URL'), '@Viagem.BR')
    await user.click(within(form).getByRole('button', { name: 'Lookup' }))
    const lang = within(form).getByLabelText('Language') as HTMLSelectElement
    expect([...lang.options].map(o => o.textContent)).toEqual(['PT-BR · Português (Brasil)', 'EN · English'])
    const niche = within(form).getByLabelText('Niche') as HTMLSelectElement
    expect([...niche.options].map(o => o.textContent)).toEqual(['Viagem', 'IA', 'Jogos', 'No niche yet'])
    const slug = within(form).getByLabelText('Slug') as HTMLInputElement
    expect(slug).toHaveValue('viagem-br')
    expect(slug).not.toHaveAttribute('readonly')
    expect(form.textContent).toContain('Slug: short id used by the forja and Cowork. It cannot be changed later.')
    await user.clear(slug)
    await user.type(slug, 'estrada')
    expect(slug).toHaveValue('estrada')
  })

  it('o dado não existe — o lookup não acha o canal, ou ele já está cadastrado: o erro fica embaixo do campo e Add channel continua desabilitado', async () => {
    const h = harness()
    h.onLookup.mockResolvedValueOnce({ ok: false, error: 'This channel is already registered as “tnfigueiredo”.' })
    const { user, form } = await open(h)
    const input = within(form).getByLabelText('Handle or URL')
    await user.type(input, 'youtube.com/@tnfigueiredo')
    await user.click(within(form).getByRole('button', { name: 'Lookup' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('This channel is already registered as “tnfigueiredo”.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(within(form).getByRole('button', { name: 'Add channel' })).toBeDisabled()
    expect(form.querySelector('[data-lookup-preview]')).toBeNull()
  })

  it('o dado não existe — o banco não sugeriu slug (coluna ausente): o campo fica desabilitado e o cadastro vai sem slug', async () => {
    const h = harness()
    h.onLookup.mockResolvedValueOnce({ ok: true, channel: FOUND, slug: null })
    const { user, form } = await open(h)
    await user.type(within(form).getByLabelText('Handle or URL'), '@Viagem.BR')
    await user.click(within(form).getByRole('button', { name: 'Lookup' }))
    expect(within(form).getByLabelText('Slug')).toBeDisabled()
    await user.click(within(form).getByRole('button', { name: 'Add channel' }))
    expect(h.onAdd).toHaveBeenCalledWith(expect.objectContaining({ slug: null }))
  })

  const lookedUp = async (h: ReturnType<typeof harness>) => {
    const o = await open(h)
    await o.user.type(within(o.form).getByLabelText('Handle or URL'), '@Viagem.BR')
    await o.user.click(within(o.form).getByRole('button', { name: 'Lookup' }))
    return o
  }

  it('Add channel: o cartão novo aparece NA HORA como pendente, só com o que o lookup trouxe; com o id real, vira o cartão do servidor', async () => {
    const h = harness()
    const d = deferred<AddChannelResult>()
    h.onAdd.mockReturnValueOnce(d.promise)
    const { user, form } = await lookedUp(h)
    await user.selectOptions(within(form).getByLabelText('Language'), 'en')
    await user.click(within(form).getByRole('button', { name: 'Add channel' }))
    // ANTES de resolver
    expect(h.onAdd).toHaveBeenCalledWith({ ...FOUND, locale: 'en', niche: 'viagem', slug: 'viagem-br' })
    const [p] = pendingCards()
    expect(pendingCards()).toHaveLength(1)
    expect(p).toHaveAttribute('aria-busy', 'true')
    expect(p!.textContent).toContain('Thiago na Estrada')
    expect(p!.textContent).toContain('@Viagem.BR')
    expect(p!.textContent).toContain('126')
    expect(p!.textContent).toContain('41')
    expect(within(p!).getByText('EN')).toBeInTheDocument()
    // nenhum número que o servidor não mandou, nenhuma ação sobre um canal que ainda não existe
    expect(p!.textContent).not.toMatch(/total views|total likes|Weekly Pick|Last sync|Nunca/)
    expect(within(p!).queryByRole('button')).toBeNull()
    expect(addForm()).toBeNull()
    expect(screen.getByRole('heading', { name: /^Channels\s*3$/ })).toBeInTheDocument()

    await settle(() => d.resolve({ ok: true, id: 'c9', slug: 'viagem-br' }))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(pendingCards()).toHaveLength(1) // continua pendente até o servidor mandar o canal
    h.rerender({ channels: [TNF, EN, CORTES, channel({ id: 'c9', name: 'Thiago na Estrada', handle: '@Viagem.BR', slug: 'viagem-br', locale: 'en' })] })
    expect(pendingCards()).toHaveLength(0)
    expect(card('c9')).not.toBeNull()
    expect(screen.getAllByText('Thiago na Estrada')).toHaveLength(1)
  })

  it('Add channel falha (slug repetido): o cartão pendente some e o formulário volta com o que foi digitado e o erro embaixo do slug', async () => {
    const h = harness()
    const d = deferred<AddChannelResult>()
    h.onAdd.mockReturnValueOnce(d.promise)
    const { user, form } = await lookedUp(h)
    await user.click(within(form).getByRole('button', { name: 'Add channel' }))
    expect(pendingCards()).toHaveLength(1)
    await settle(() => d.resolve({ ok: false, error: 'Slug “viagem-br” is already used by “Thiago na Estrada”.', field: 'slug' }))
    expect(pendingCards()).toHaveLength(0)
    expect(refresh).not.toHaveBeenCalled()
    const back = addForm()!
    expect(within(back).getByRole('alert')).toHaveTextContent('Slug “viagem-br” is already used by “Thiago na Estrada”.')
    expect(within(back).getByLabelText('Slug')).toHaveAttribute('aria-invalid', 'true')
    expect(within(back).getByLabelText('Slug')).toHaveValue('viagem-br')
    expect(back.querySelector('[data-lookup-preview]')!.textContent).toContain('Thiago na Estrada')
    expect(within(back).getByRole('button', { name: 'Add channel' })).toBeEnabled()
  })

  it('Add channel lança (rede): o cartão pendente some com aviso, nada fica preso', async () => {
    const h = harness()
    h.onAdd.mockRejectedValueOnce(new Error('network'))
    const { user, form } = await lookedUp(h)
    await user.click(within(form).getByRole('button', { name: 'Add channel' }))
    await settle(() => {})
    expect(pendingCards()).toHaveLength(0)
    expect(within(addForm()!).getByRole('alert')).toHaveTextContent('Error saving')
  })

  it('slug mal formado é recusado na hora, sem chamar a action', async () => {
    const h = harness()
    const { user, form } = await lookedUp(h)
    const slug = within(form).getByLabelText('Slug')
    await user.clear(slug)
    await user.type(slug, 'Não Vale')
    await user.click(within(form).getByRole('button', { name: 'Add channel' }))
    expect(h.onAdd).not.toHaveBeenCalled()
    expect(within(form).getByRole('alert')).toHaveTextContent('Use lowercase letters, numbers and hyphens (2 to 32 characters).')
    expect(pendingCards()).toHaveLength(0)
  })

  it('o dado não existe — site só com os nichos de fábrica: o seletor oferece os dois e "No niche yet", e sem nicho o cadastro passa com null', async () => {
    const h = harness()
    const { user, form } = await lookedUp(h)
    const niche = within(form).getByLabelText('Niche') as HTMLSelectElement
    expect([...niche.options].map(o => o.textContent)).toEqual(['Viagem', 'IA', 'No niche yet'])
    await user.selectOptions(niche, 'No niche yet')
    await user.click(within(form).getByRole('button', { name: 'Add channel' }))
    expect(h.onAdd).toHaveBeenCalledWith(expect.objectContaining({ niche: null }))
  })

  it('Cancel fecha o formulário sem chamar nada', async () => {
    const h = harness()
    const { user, form } = await open(h)
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(addForm()).toBeNull()
    expect(h.onLookup).not.toHaveBeenCalled()
  })
})

describe('idioma e nicho no cartão (Configurar)', () => {
  const config = async (id: string) => {
    const user = userEvent.setup()
    await user.click(within(card(id)).getByRole('button', { name: 'Configurar' }))
    return user
  }

  it('o slug aparece só para leitura, com a frase que diz que não muda', async () => {
    harness()
    await config('c1')
    const slug = within(card('c1')).getByLabelText('Slug')
    expect(slug).toHaveValue('tnfigueiredo')
    expect(slug).toHaveAttribute('readonly')
    expect(card('c1').textContent).toContain('The slug is the id the forja and Cowork use. It cannot be changed.')
  })

  it('trocar o nicho: o valor muda NA HORA no seletor e na faixa, ocupado até a action resolver; no sucesso pede os dados novos', async () => {
    const h = harness({ niches: [VIAGEM, IA, JOGOS] })
    const d = deferred<SimpleResult>()
    h.onUpdateIdentity.mockReturnValueOnce(d.promise)
    const user = await config('c1')
    const sel = within(card('c1')).getByLabelText('Niche')
    await user.selectOptions(sel, 'jogos')
    // ANTES de resolver
    expect(h.onUpdateIdentity).toHaveBeenCalledWith({ channel_id: 'c1', locale: 'pt', niche: 'jogos' })
    expect(sel).toHaveValue('jogos')
    expect(sel).toHaveAttribute('aria-busy', 'true')
    expect(card('c1').querySelector('[data-ident-niche]')).toHaveTextContent('Jogos')
    await settle(() => d.resolve({ ok: true }))
    expect(sel).not.toHaveAttribute('aria-busy')
    expect(sel).toHaveValue('jogos')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('trocar o nicho falha: volta ao valor anterior, com aviso', async () => {
    const h = harness({ niches: [VIAGEM, IA, JOGOS] })
    const d = deferred<SimpleResult>()
    h.onUpdateIdentity.mockReturnValueOnce(d.promise)
    const user = await config('c1')
    const sel = within(card('c1')).getByLabelText('Niche')
    await user.selectOptions(sel, 'jogos')
    expect(sel).toHaveValue('jogos')
    await settle(() => d.resolve({ ok: false, error: 'Niche not found. Reload the page and try again.' }))
    expect(sel).toHaveValue('viagem')
    expect(card('c1').querySelector('[data-ident-niche]')).toHaveTextContent('Viagem')
    expect(within(card('c1')).getByRole('alert')).toHaveTextContent('Niche not found. Reload the page and try again.')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('trocar o idioma: o chip muda NA HORA; se a action lançar, volta com aviso', async () => {
    const h = harness()
    const d = deferred<SimpleResult>()
    h.onUpdateIdentity.mockReturnValueOnce(d.promise)
    const user = await config('c1')
    const sel = within(card('c1')).getByLabelText('Language')
    await user.selectOptions(sel, 'en')
    expect(h.onUpdateIdentity).toHaveBeenCalledWith({ channel_id: 'c1', locale: 'en', niche: 'viagem' })
    expect(sel).toHaveValue('en')
    expect(sel).toHaveAttribute('aria-busy', 'true')
    expect(card('c1').querySelector('[data-lang-chip]')).toHaveTextContent('EN')
    await settle(() => d.reject(new Error('network')))
    expect(sel).toHaveValue('pt')
    expect(card('c1').querySelector('[data-lang-chip]')).toHaveTextContent('PT-BR')
    expect(within(card('c1')).getByRole('alert')).toHaveTextContent('Error saving')
  })

  it('duas trocas seguidas: vale a última, e a resposta atrasada da primeira não desfaz a segunda', async () => {
    const h = harness({ niches: [VIAGEM, IA, JOGOS] })
    const first = deferred<SimpleResult>(), second = deferred<SimpleResult>()
    h.onUpdateIdentity.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const user = await config('c1')
    const sel = within(card('c1')).getByLabelText('Niche')
    await user.selectOptions(sel, 'jogos')
    await user.selectOptions(sel, 'ia')
    await settle(() => first.resolve({ ok: false, error: 'x' }))
    expect(sel).toHaveValue('ia')
    expect(sel).toHaveAttribute('aria-busy', 'true')
    await settle(() => second.resolve({ ok: true }))
    expect(sel).toHaveValue('ia')
  })

  it('tirar o nicho: "No niche yet" manda null', async () => {
    const h = harness()
    const user = await config('c1')
    await user.selectOptions(within(card('c1')).getByLabelText('Niche'), 'No niche yet')
    expect(h.onUpdateIdentity).toHaveBeenCalledWith({ channel_id: 'c1', locale: 'pt', niche: null })
  })
})

describe('remoção', () => {
  const askRemoval = async (id = 'c1') => {
    const user = userEvent.setup()
    await user.click(within(card(id)).getByRole('button', { name: 'Configurar' }))
    expect(card(id).textContent).toContain('Remove this channel and everything synced from it. You will see what is deleted before confirming.')
    await user.click(within(card(id)).getByRole('button', { name: 'Remove channel…' }))
    return user
  }
  const panel = () => card('c1').querySelector<HTMLElement>('[data-removal]')!

  it('a confirmação abre NA HORA no cartão, ocupada até as contagens chegarem; depois lista o que será apagado', async () => {
    const h = harness()
    const d = deferred<RemovalImpactResult>()
    h.onRemovalImpact.mockReturnValueOnce(d.promise)
    await askRemoval()
    // ANTES de resolver: título conhecido, nenhuma contagem
    expect(within(panel()).getByRole('heading', { name: 'Remove “tnFigueiredo”?' })).toBeInTheDocument()
    expect(panel()).toHaveAttribute('aria-busy', 'true')
    expect(panel().querySelector('li')).toBeNull()
    expect(within(panel()).queryByRole('button', { name: 'Remove channel' })).toBeNull()
    expect(h.onRemovalImpact).toHaveBeenCalledWith({ channelId: 'c1' })
    await settle(() => d.resolve({ ok: true, impact: IMPACT }))
    expect(panel()).not.toHaveAttribute('aria-busy')
    expect(panel().textContent).toContain('This permanently deletes:')
    expect([...panel().querySelectorAll('li')].map(li => li.textContent)).toEqual([
      '212videos, with their analytics, grades and optimization cycles',
      '48curated comments',
      '864sync log entries',
      '3finished A/B tests, with their variants and results',
      '9intelligence analyses and 2 queued tasks',
      '14notes',
    ])
    expect(panel().textContent).toContain('6 pipeline items keep their content and lose the link to their video.')
    expect(panel().textContent).toContain('All of it is removed at once, or nothing is. This cannot be undone.')
  })

  it('o botão habilita ao digitar o slug, SEM ida ao servidor; antes disso fica desabilitado', async () => {
    const h = harness()
    const user = await askRemoval()
    const btn = within(panel()).getByRole('button', { name: 'Remove channel' })
    expect(btn).toBeDisabled()
    const input = within(panel()).getByLabelText(/Type tnfigueiredo to confirm/)
    await user.type(input, 'tnfigueired')
    expect(btn).toBeDisabled()
    await user.type(input, 'o')
    expect(btn).toBeEnabled()
    expect(h.onRemove).not.toHaveBeenCalled()
    expect(h.onRemovalImpact).toHaveBeenCalledTimes(1)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('confirmar: o cartão marca "removing" NA HORA; no sucesso pede os dados novos e continua marcado até sumir', async () => {
    const h = harness()
    const d = deferred<RemoveChannelResult>()
    h.onRemove.mockReturnValueOnce(d.promise)
    const user = await askRemoval()
    await user.type(within(panel()).getByLabelText(/Type tnfigueiredo to confirm/), 'tnfigueiredo')
    await user.click(within(panel()).getByRole('button', { name: 'Remove channel' }))
    // ANTES de resolver
    expect(h.onRemove).toHaveBeenCalledWith({ channelId: 'c1', confirmSlug: 'tnfigueiredo' })
    expect(card('c1')).toHaveAttribute('data-removing')
    expect(card('c1')).toHaveAttribute('aria-busy', 'true')
    expect(within(panel()).getByRole('button', { name: 'Remove channel' })).toBeDisabled()
    expect(within(panel()).getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await settle(() => d.resolve({ ok: true }))
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(card('c1')).toHaveAttribute('data-removing')
    h.rerender({ channels: [EN, CORTES] })
    expect(document.querySelector('[data-channel="c1"]')).toBeNull()
    expect(screen.getByRole('heading', { name: /^Channels\s*2$/ })).toBeInTheDocument()
  })

  it('a remoção falha: o cartão volta ao normal, com o aviso, e nada foi pedido de novo ao servidor', async () => {
    const h = harness()
    const d = deferred<RemoveChannelResult>()
    h.onRemove.mockReturnValueOnce(d.promise)
    const user = await askRemoval()
    await user.type(within(panel()).getByLabelText(/Type tnfigueiredo to confirm/), 'tnfigueiredo')
    await user.click(within(panel()).getByRole('button', { name: 'Remove channel' }))
    expect(card('c1')).toHaveAttribute('data-removing')
    await settle(() => d.resolve({ ok: false, error: 'falha forçada no meio' }))
    expect(card('c1')).not.toHaveAttribute('data-removing')
    expect(card('c1')).not.toHaveAttribute('aria-busy')
    expect(within(panel()).getByRole('alert')).toHaveTextContent('falha forçada no meio')
    expect(refresh).not.toHaveBeenCalled()
    expect(within(panel()).getByRole('button', { name: 'Remove channel' })).toBeEnabled()
  })

  it('Cancel fecha a confirmação sem remover', async () => {
    const h = harness()
    const user = await askRemoval()
    await user.click(within(panel()).getByRole('button', { name: 'Cancel' }))
    expect(card('c1').querySelector('[data-removal]')).toBeNull()
    expect(h.onRemove).not.toHaveBeenCalled()
  })

  const B1 = { id: 't1', name: 'Thumbnail: mapa vs rosto', status: 'active' as const, since: '2026-10-18T15:00:00Z', videoTitle: 'Quanto custa viajar pela Geórgia?' }
  const B2 = { id: 't2', name: 'Título: pergunta vs número', status: 'active' as const, since: '2026-10-21T15:00:00Z', videoTitle: '7 dias em Baku gastando pouco' }

  it('teste A/B rodando: diz qual teste parar, leva ao A/B Lab, e não há botão de confirmar nem campo de slug', async () => {
    const h = harness()
    h.onRemovalImpact.mockResolvedValueOnce({ ok: true, impact: { ...IMPACT, blockers: [B1] } })
    await askRemoval()
    const p = panel()
    expect(p).toHaveAttribute('role', 'alert')
    expect(within(p).getByRole('heading', { name: '“tnFigueiredo” cannot be removed yet' })).toBeInTheDocument()
    expect(p.textContent).toContain('An A/B test is running on one of its videos. Stop it first:')
    expect(p.textContent).toContain('“Thumbnail: mapa vs rosto” · running since Oct 18, on “Quanto custa viajar pela Geórgia?”')
    expect(p.textContent).toContain('Finished tests do not block: they are deleted with the channel. Nothing was deleted.')
    expect(within(p).getByRole('link', { name: 'Open A/B Lab →' })).toHaveAttribute('href', '/cms/youtube/ab-lab')
    expect(within(p).queryByRole('button', { name: 'Remove channel' })).toBeNull()
    expect(within(p).queryByRole('textbox')).toBeNull()
    expect(h.onRemove).not.toHaveBeenCalled()
    await userEvent.setup().click(within(p).getByRole('button', { name: 'Close' }))
    expect(card('c1').querySelector('[data-removal]')).toBeNull()
  })

  it('dois testes rodando: os dois são listados, com a frase no plural', async () => {
    const h = harness()
    h.onRemovalImpact.mockResolvedValueOnce({ ok: true, impact: { ...IMPACT, blockers: [B1, B2] } })
    await askRemoval()
    expect(panel().textContent).toContain('A/B tests are running on its videos. Stop them first:')
    expect(panel().textContent).toContain('“Thumbnail: mapa vs rosto”')
    expect(panel().textContent).toContain('“Título: pergunta vs número” · running since Oct 21, on “7 dias em Baku gastando pouco”')
  })

  it('um teste começou entre a contagem e a confirmação: a remoção volta bloqueada e a tela mostra o bloqueio', async () => {
    const h = harness()
    h.onRemove.mockResolvedValueOnce({ ok: false, error: '“tnFigueiredo” cannot be removed yet', blockers: [B1] })
    const user = await askRemoval()
    await user.type(within(panel()).getByLabelText(/Type tnfigueiredo to confirm/), 'tnfigueiredo')
    await user.click(within(panel()).getByRole('button', { name: 'Remove channel' }))
    await settle(() => {})
    expect(within(panel()).getByRole('heading', { name: '“tnFigueiredo” cannot be removed yet' })).toBeInTheDocument()
    expect(card('c1')).not.toHaveAttribute('data-removing')
  })

  it('o dado não existe — canal sem nada dependente: todas as linhas com zero, e a remoção segue', async () => {
    const h = harness()
    h.onRemovalImpact.mockResolvedValueOnce({ ok: true, impact: { ...IMPACT, videos: 0, comments: 0, syncLogs: 0, abTests: 0, analyses: 0, tasks: 0, notes: 0, pipelineLinks: 0 } })
    const user = await askRemoval()
    expect([...panel().querySelectorAll('li')].map(li => li.textContent)).toEqual([
      '0videos, with their analytics, grades and optimization cycles', '0curated comments', '0sync log entries',
      '0finished A/B tests, with their variants and results', '0intelligence analyses and 0 queued tasks', '0notes',
    ])
    await user.type(within(panel()).getByLabelText(/Type tnfigueiredo to confirm/), 'tnfigueiredo')
    await user.click(within(panel()).getByRole('button', { name: 'Remove channel' }))
    expect(h.onRemove).toHaveBeenCalledTimes(1)
  })

  it('o dado não existe — função de remoção ausente no banco: a mensagem honesta, sem botão de confirmar', async () => {
    const h = harness()
    h.onRemovalImpact.mockResolvedValueOnce({ ok: false, error: 'Channel removal is not available yet: a database update is pending. Nothing was deleted.' })
    await askRemoval()
    expect(within(panel()).getByRole('alert')).toHaveTextContent('Channel removal is not available yet: a database update is pending. Nothing was deleted.')
    expect(within(panel()).queryByRole('button', { name: 'Remove channel' })).toBeNull()
    expect(h.onRemove).not.toHaveBeenCalled()
  })
})

describe('nichos', () => {
  it('lista os nichos do site com quantos canais próprios E quantos concorrentes usam cada um; os de fábrica têm a marca', () => {
    harness({ niches: [VIAGEM, IA, JOGOS] })
    const rows = [...nichesBlock().querySelectorAll<HTMLElement>('[data-niche-row]')]
    expect(rows.map(r => r.dataset.nicheRow)).toEqual(['viagem', 'ia', 'jogos'])
    expect(rows[0]!.textContent).toContain('Viagem')
    expect(rows[0]!.textContent).toContain('built-in')
    expect(rows[0]!.textContent).toContain('3 channels · 12 competitors')
    expect(rows[1]!.textContent).toContain('no channels yet · 0 competitors')
    expect(rows[2]!.textContent).not.toContain('built-in')
    expect(rows[2]!.textContent).toContain('1 channel · 1 competitor')
    expect(within(nichesBlock()).getByRole('heading', { name: /^Niches\s*3$/ })).toBeInTheDocument()
    expect(nichesBlock().textContent).toContain('A niche groups your channels with the competitors you track in the Observatório. A niche can have more than one channel.')
    expect(nichesBlock().textContent).toContain('New niches start without a theme list in the Observatório. Niches can’t be renamed or deleted yet.')
  })

  it('o dado não existe — contagem de concorrentes indisponível: mostra só os canais, sem inventar zero', () => {
    harness({ niches: [{ ...VIAGEM, competitors: null }] })
    const row = nichesBlock().querySelector<HTMLElement>('[data-niche-row="viagem"]')!
    expect(row.textContent).toContain('3 channels')
    expect(row.textContent).not.toMatch(/competitor/)
  })

  it('quatro cores, e só elas; o slug sai do nome enquanto se digita', async () => {
    harness()
    const user = userEvent.setup()
    expect(within(nichesBlock()).getAllByRole('radio').map(r => r.getAttribute('aria-label'))).toEqual(['Plum', 'Pink', 'Lime', 'Slate'])
    await user.type(within(nichesBlock()).getByLabelText('Name'), 'Culinária Fácil')
    expect(nichesBlock().textContent).toContain('Slug: culinaria-facil.')
  })

  it('criar nicho: aparece na lista NA HORA, ocupado e sem contagem inventada; quando o servidor manda, vira a linha de verdade', async () => {
    const h = harness()
    const d = deferred<CreateNicheResult>()
    h.onCreateNiche.mockReturnValueOnce(d.promise)
    const user = userEvent.setup()
    await user.type(within(nichesBlock()).getByLabelText('Name'), 'Jogos')
    await user.click(within(nichesBlock()).getByRole('radio', { name: 'Pink' }))
    await user.click(within(nichesBlock()).getByRole('button', { name: 'Add niche' }))
    // ANTES de resolver
    expect(h.onCreateNiche).toHaveBeenCalledWith({ label: 'Jogos', color: 'rosa' })
    const row = nichesBlock().querySelector<HTMLElement>('[data-niche-row="jogos"]')!
    expect(row).toHaveAttribute('aria-busy', 'true')
    expect(row.textContent).toContain('Jogos')
    expect(row.textContent).toContain('jogos')
    expect(row.textContent).not.toMatch(/channel|competitor/)
    expect(within(nichesBlock()).getByLabelText('Name')).toHaveValue('')
    await settle(() => d.resolve({ ok: true, slug: 'jogos' }))
    expect(refresh).toHaveBeenCalledTimes(1)
    h.rerender({ niches: [VIAGEM, IA, { ...JOGOS, channels: 0, competitors: 0 }] })
    const rows = nichesBlock().querySelectorAll('[data-niche-row="jogos"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]).not.toHaveAttribute('aria-busy')
    expect(rows[0]!.textContent).toContain('no channels yet · 0 competitors')
  })

  it('criar nicho falha: a linha some, o nome volta ao campo e o erro aparece', async () => {
    const h = harness()
    const d = deferred<CreateNicheResult>()
    h.onCreateNiche.mockReturnValueOnce(d.promise)
    const user = userEvent.setup()
    await user.type(within(nichesBlock()).getByLabelText('Name'), 'Jogos')
    await user.click(within(nichesBlock()).getByRole('button', { name: 'Add niche' }))
    expect(nichesBlock().querySelector('[data-niche-row="jogos"]')).not.toBeNull()
    await settle(() => d.resolve({ ok: false, error: 'A niche named “Jogos” already exists.' }))
    expect(nichesBlock().querySelector('[data-niche-row="jogos"]')).toBeNull()
    expect(within(nichesBlock()).getByLabelText('Name')).toHaveValue('Jogos')
    expect(within(nichesBlock()).getByRole('alert')).toHaveTextContent('A niche named “Jogos” already exists.')
    expect(within(nichesBlock()).getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(refresh).not.toHaveBeenCalled()
  })

  it.each([
    ['Viagem', 'A niche named “Viagem” already exists.'],
    [' viagem ', 'A niche named “Viagem” already exists.'],
    ['Todos', 'Choose another name for this niche.'],
    ['C++', 'Choose another name for this niche.'],
  ])('nome que não serve (%s): o erro aparece na hora, sem chamar a action', async (name, msg) => {
    const h = harness()
    const user = userEvent.setup()
    await user.type(within(nichesBlock()).getByLabelText('Name'), name)
    await user.click(within(nichesBlock()).getByRole('button', { name: 'Add niche' }))
    expect(within(nichesBlock()).getByRole('alert')).toHaveTextContent(msg)
    expect(h.onCreateNiche).not.toHaveBeenCalled()
  })

  it('o dado não existe — tabela de nichos ausente no banco: os de fábrica aparecem, e criar fica desabilitado com a razão', () => {
    harness({ nichesAvailable: false, niches: [{ ...VIAGEM, competitors: null }, { ...IA, competitors: null }] })
    expect(within(nichesBlock()).getByRole('button', { name: 'Add niche' })).toBeDisabled()
    expect(nichesBlock().textContent).toContain('Niches cannot be created yet: a database update is pending.')
    expect(nichesBlock().querySelectorAll('[data-niche-row]')).toHaveLength(2)
  })
})
