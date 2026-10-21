// @vitest-environment jsdom
// F2 do Remover canal, T8: o canal agendado na lista de Canais (linha, cartão, menu), o Desfazer, o pedido ao agente e os toasts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const siteAdmin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => siteAdmin.value,
}))
import { render, screen, act, fireEvent, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { a3World } from './a3-fixture'
import { buildCanaisView } from '@/app/cms/(authed)/youtube/competitors/_canais/view-model'
import { CanaisScreen } from '@/app/cms/(authed)/youtube/competitors/_canais/canais-screen'
import { ToastProvider } from '@/app/cms/(authed)/youtube/competitors/_chrome/toasts'
import { ChromeSyncContext } from '@/app/cms/(authed)/youtube/competitors/_chrome/sync-context'
import { TXT, desfeitoCorpo, pedidoAoAgente } from '@/app/cms/(authed)/youtube/competitors/_canais/remover-model'
import { marcarRemovido } from '@/app/cms/(authed)/youtube/competitors/_canais/removido-flag'

const replace = vi.fn(), refresh = vi.fn(), push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push, prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/cms/youtube/competitors',
  useSearchParams: () => new URLSearchParams('fmt=longos'),
}))

const DIA = 86_400_000
const IMPACTO = { ok: true as const, impact: { name: 'X', videos: 340, pinned: 2, versions: 1208, dailyDays: 12, bookmarks: 3, readings: 28, watch: { readings: 20, thumbs: 0, alvos: 0 } }, semGuardar: { pode: true as const } }
let agendadoId = '', normalId = '', agendadoNome = ''
const w = () => a3World(ds => {
  const [a, b] = ds.channels.filter(c => !c.own)
  agendadoId = a!.id; normalId = b!.id; agendadoNome = a!.name
  a!.removalRequestedAt = new Date(ds.now - 2 * DIA).toISOString()
})

type Desf = (id: string) => Promise<unknown>
function montar(o: { desfazer?: Desf; email?: string | null; layout?: 'cards'; pedir?: ReturnType<typeof vi.fn>; apagar?: ReturnType<typeof vi.fn> } = {}) {
  const mundo = w()
  const onDesfazer = vi.fn(o.desfazer ?? (async () => ({ ok: true, naoPedido: false, despausado: true })))
  const v = buildCanaisView(mundo.obs, { niche: 'todos', limit: 75, fmt: 'longos', ...(o.layout ? { layout: o.layout } : {}) })
  const ok = async () => ({ ok: true })
  const r = render(
    <ToastProvider><ChromeSyncContext.Provider value={{ running: false }}><div data-obs="">
      <h1>Canais</h1>
      <CanaisScreen view={v} canUnlock={false} meuEmail={o.email === undefined ? 'dono@exemplo.com' : o.email} onAdd={ok} onPedir={(o.pedir ?? vi.fn(async () => ({ ok: true, jaPedido: false }))) as never} onApagar={(o.apagar ?? vi.fn(async () => ({ ok: true, videos: 340, leituras: 48, registrosDiarios: 1208 }))) as never} onDesfazer={onDesfazer as never} onUnlock={ok} onSetNiche={ok} onSetOwnNiche={ok} onSyncOne={ok} onRemovalImpact={vi.fn(async () => IMPACTO) as never} />
    </div></ChromeSyncContext.Provider></ToastProvider>,
  )
  return { ...r, onDesfazer }
}
const tr = (id: string) => document.querySelector<HTMLElement>(`tbody tr.row[data-id="${id}"]`)!
const card = (id: string) => document.querySelector<HTMLElement>(`.cards article[data-id="${id}"]`)!
const desfazerDaLinha = () => within(tr(agendadoId)).getByRole('button', { name: /^Desfazer/ })

beforeEach(() => { replace.mockReset(); refresh.mockReset(); push.mockReset(); siteAdmin.value = true; sessionStorage.clear() })
afterEach(() => { cleanup(); document.getElementById('flut')?.remove(); vi.restoreAllMocks() })

describe('Canais · canal agendado', () => {
  it('L8.1 a linha e o cartão mostram selo, idade, Desfazer e Copiar pedido; a linha tem a classe agd; as outras não', () => {
    montar()
    checar([tr(agendadoId)], [tr(normalId)])
    cleanup()
    montar({ layout: 'cards' })
    checar([card(agendadoId)], [card(normalId)])
  })
  function checar(ags: HTMLElement[], normais: HTMLElement[]) {
    for (const el of ags) {
      expect(el.classList.contains('agd')).toBe(true)
      expect(el.textContent).toContain(TXT.selo)
      expect(el.textContent).toContain(`${TXT.aguardando} · agendado há 2 dias`)
      expect(within(el).getByRole('button', { name: /^Desfazer/ })).toBeTruthy()
      expect(within(el).getByRole('button', { name: 'Copiar pedido ao agente' })).toBeTruthy()
    }
    for (const el of normais) {
      expect(el.classList.contains('agd')).toBe(false)
      expect(el.textContent).not.toContain(TXT.selo)
    }
  }

  it('L8.1b sem poder administrar: selo e idade, nenhum botão', () => {
    siteAdmin.value = false
    montar()
    const el = tr(agendadoId)
    expect(el.textContent).toContain(TXT.aguardando)
    expect(within(el).queryByRole('button', { name: /^Desfazer/ })).toBeNull()
    expect(within(el).queryByRole('button', { name: 'Copiar pedido ao agente' })).toBeNull()
  })

  it('L8.2 o menu do agendado tem o item de duas linhas, aria-disabled, e clicar não abre a janela', async () => {
    const user = userEvent.setup()
    montar()
    await user.click(within(tr(agendadoId)).getByRole('button', { name: /^Mais ações/ }))
    const item = screen.getByRole('menuitem', { name: /Remover canal/ })
    expect(item.getAttribute('aria-disabled')).toBe('true')
    expect(item.textContent).toBe(`Remover canal…${TXT.itemJaAgendado}`)
    expect(item.tagName).not.toBe('BUTTON')
    await user.click(item)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it('L8.3 Desfazer chama onDesfazer, mostra o toast e atualiza; o botão fica aria-busy e o 2º clique não chama de novo', async () => {
    let fim!: (v: unknown) => void
    const { onDesfazer } = montar({ desfazer: () => new Promise(r => { fim = r }) })
    fireEvent.click(desfazerDaLinha()); fireEvent.click(desfazerDaLinha())
    expect(onDesfazer).toHaveBeenCalledTimes(1)
    expect(onDesfazer).toHaveBeenCalledWith(agendadoId)
    expect(desfazerDaLinha().getAttribute('aria-busy')).toBe('true')
    await act(async () => { fim({ ok: true, naoPedido: false, despausado: true }) })
    expect(screen.getByText(TXT.desfeitoTitulo)).toBeTruthy()
    expect(screen.getByText(desfeitoCorpo(agendadoNome, true))).toBeTruthy()
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(desfazerDaLinha().hasAttribute('aria-busy')).toBe(false)
  })

  it('L8.3 despausado=false: o corpo diz que o canal continua pausado (U3)', async () => {
    montar({ desfazer: async () => ({ ok: true, naoPedido: false, despausado: false }) })
    fireEvent.click(desfazerDaLinha())
    await act(async () => {})
    expect(screen.getByText(`A remoção de ${agendadoNome} foi cancelada. O canal continua pausado, como estava antes.`)).toBeTruthy()
  })

  it('L8.4 naoPedido e canal_nao_encontrado: toast neutro e refresh; sem_vaga: toast vermelho sem refresh', async () => {
    const m1 = montar({ desfazer: async () => ({ ok: true, naoPedido: true, despausado: false }) })
    fireEvent.click(desfazerDaLinha()); await act(async () => {})
    expect(screen.getByText(TXT.jaNaoAgendado(agendadoNome))).toBeTruthy()
    expect(document.querySelector('.obs-ch-bad')).toBeNull()
    expect(refresh).toHaveBeenCalledTimes(1)
    m1.unmount(); refresh.mockReset()

    const m2 = montar({ desfazer: async () => ({ ok: false, codigo: 'canal_nao_encontrado', frase: 'Este canal já foi removido. Atualize a página.' }) })
    fireEvent.click(desfazerDaLinha()); await act(async () => {})
    expect(screen.getByText('Este canal já foi removido. Atualize a página.')).toBeTruthy()
    expect(document.querySelector('.obs-ch-bad')).toBeNull()
    expect(refresh).toHaveBeenCalledTimes(1)
    m2.unmount(); refresh.mockReset()

    montar({ desfazer: async () => ({ ok: false, codigo: 'sem_vaga', frase: 'Sem vaga para retomar a coleta.' }) })
    fireEvent.click(desfazerDaLinha()); await act(async () => {})
    expect(screen.getByText('Sem vaga para retomar a coleta.')).toBeTruthy()
    expect(document.querySelector('.obs-ch-bad')).not.toBeNull()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('L8.5 Copiar pedido escreve o texto do agente na área de transferência e avisa; sem clipboard, toast com o texto para selecionar', async () => {
    const write = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: write }, configurable: true })
    montar()
    fireEvent.click(within(tr(agendadoId)).getByRole('button', { name: 'Copiar pedido ao agente' }))
    await act(async () => {})
    expect(write).toHaveBeenCalledWith(pedidoAoAgente(agendadoNome, 'dono@exemplo.com'))
    expect(screen.getByText(TXT.pedidoCopiadoTitulo)).toBeTruthy()
    cleanup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('negado') } }, configurable: true })
    montar()
    fireEvent.click(within(tr(agendadoId)).getByRole('button', { name: 'Copiar pedido ao agente' }))
    await act(async () => {})
    expect(screen.getByText('Não deu para copiar')).toBeTruthy()
    expect(document.body.textContent).toContain('npx tsx scripts/obs-arquivo.ts pedidos --por dono@exemplo.com')
  })

  async function abrirRemover(user: ReturnType<typeof userEvent.setup>) {
    await user.click(within(tr(normalId)).getByRole('button', { name: /^Mais ações/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Remover canal…' }))
    await act(async () => {})
  }

  it('L8.6 guardar: a janela fecha, o toast traz Desfazer (mesmo fluxo do botão da linha), a lista atualiza e o foco vai ao ⋯ da mesma linha (U5)', async () => {
    const user = userEvent.setup()
    const { onDesfazer } = montar()
    await abrirRemover(user)
    await user.click([...document.querySelectorAll('button')].find(b => b.textContent === 'Parar coleta e agendar guarda no NAS')!)
    await act(async () => {})
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(screen.getByText(TXT.toastAgendadoTitulo)).toBeTruthy()
    expect(refresh).toHaveBeenCalled()
    expect(document.activeElement).toBe(within(tr(normalId)).getByRole('button', { name: /^Mais ações/ }))
    await user.click([...document.querySelectorAll('.obs-ch-toast-acoes button')].find(b => b.textContent === 'Desfazer')!)
    expect(onDesfazer).toHaveBeenCalledWith(normalId)
  })

  it('L8.7 apagar: toast "Apagado" com os números devolvidos, lista atualiza, foco no título', async () => {
    const user = userEvent.setup()
    montar()
    await abrirRemover(user)
    const nome = within(tr(normalId)).getByRole('link', { name: /^Abrir a página de / }).textContent!
    await user.click(document.querySelector('input[type="radio"][value="apagar"]')!)
    await user.type(document.querySelector<HTMLInputElement>('.fld input')!, nome)
    await user.click([...document.querySelectorAll('button')].find(b => b.textContent === 'Apagar sem guardar')!)
    await act(async () => {})
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(screen.getByText(TXT.toastApagadoTitulo)).toBeTruthy()
    expect(document.body.textContent).toContain(`${nome} saiu, sem cópia: 340 vídeos e 48 leituras.`)
    expect(refresh).toHaveBeenCalled()
    expect(document.activeElement?.textContent).toBe('Canais')
  })

  it('L8.9 o aviso "apagado" da página do canal vem do estado do navegador (não da URL), uma vez', () => {
    marcarRemovido({ nome: 'Canal X', videos: 12, leituras: 340 })
    montar()
    expect(screen.getByText(TXT.toastApagadoTitulo)).toBeTruthy()
    expect(document.body.textContent).toContain('Canal X saiu, sem cópia: 12 vídeos e 340 leituras.')
    expect(sessionStorage.getItem('obs-canal-removido')).toBeNull()
  })

  it('L8.9b sem o aviso guardado, nenhum "Apagado" (link forjado não afirma nada)', () => {
    montar()
    expect(screen.queryByText(TXT.toastApagadoTitulo)).toBeNull()
  })

  it('L8.8 abaixo de 600 px os botões da linha agendada têm 44 px e o nome trunca (CSS lido)', () => {
    const css = readFileSync(resolve(__dirname, '../../../src/app/cms/(authed)/youtube/competitors/_canais/canais.css'), 'utf8')
    expect(css).toMatch(/@media \(max-width:600px\)\{\[data-obs-screen="canais"\] \.agd \.agd-acoes \.btn\{min-height:44px\}\}/)
    expect(css).toMatch(/\.agd \.nmbtn\{[^}]*text-overflow:ellipsis/)
    expect(css).toMatch(/\.agd-acoes \.btn\{flex:none/)
    expect(css).toMatch(/\.card\.agd\{border-left:3px solid var\(--warning-text\);background:var\(--warn-subtle\)\}/)
  })
})
