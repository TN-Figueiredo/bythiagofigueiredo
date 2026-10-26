// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
import type { ResultadoAcaoSaida } from '@/lib/youtube/ab-acao-saida'
import { MSG_OUTRO_TESTE, MSG_MUDOU, MSG_JA_ENCERRADO, MSG_EM_ANDAMENTO, MSG_FALHA_SAIDA } from '@/lib/youtube/ab-acao-saida'

const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh, back: vi.fn() }) }))
vi.mock('@/app/cms/(authed)/youtube/_components/yt-portal', () => ({
  YtPortal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
const admin = vi.hoisted(() => ({ value: true }))
vi.mock('@/lib/cms/site-admin-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/cms/site-admin-context')>()),
  useCanAdminSite: () => admin.value,
}))

import { ConcluidoV2Detail } from '@/app/cms/(authed)/youtube/ab-lab/_components/concluido-v2-detail'
import { faixaDaPagina } from '@/app/cms/(authed)/youtube/ab-lab/_components/faixa-da-pagina'
import { telaV2DoTeste } from '@/lib/youtube/ab-gravacao/tela-v2'
import type { TelaV2 } from '@/lib/youtube/ab-gravacao/tela-v2'
import type { AbTestDetailView } from '@/lib/youtube/ab-types'

type Concl = Extract<TelaV2, { fase: 'concluido' }>
const base = (o: Partial<Concl> = {}): Concl => ({
  fase: 'concluido', selo: { tipo: 'vence', provisorio: true, letra: 'B' },
  frase: { principal: 'B provavelmente vence.', apoio: 'CTR ≈ 5,4% contra 4,6% de A (+17,4% vs A).' },
  prazo: { tipo: 'provisorio', ate: '04/11' }, noAr: { tipo: 'original' }, aplicar: { variant_id: 'v-b', letra: 'B' }, voltar: false, aplicarDeNovo: null, bloqueio: null,
  n: 10315, pisos: [
    { variant_id: 'v-a', letra: 'A', titulo: 'Título A', volume: 11000, dias_validos: 4 },
    { variant_id: 'v-b', letra: 'B', titulo: 'Título B', volume: 10400, dias_validos: 4 },
  ], tentarDeNovo: false, ...o,
})
const em = (dias: number) => new Date(Date.now() + dias * 86400000).toISOString()
function view(v2: Concl, o: Record<string, unknown> = {}): AbTestDetailView & { v2: Concl } {
  return {
    id: 't1', videoTitle: 'Meu vídeo', flag: 'thumbnail', status: 'completed', outcome: 'winner', winnerLabel: 'B', winnerColor: '#888',
    lift: null, confidence: null, resultMeta: {}, variants: [], variantThumbs: [], totalRounds: 1, hasPlayoff: false, restoreSeq: 7,
    placar: null, faixa_dias: [], completedAt: '2026-10-24T12:00:00Z', revertExpiresAt: null, noArAgora: null, activeNow: null,
    variantDb: [
      { id: 'v-a', label: 'A', is_original: true, blob_url: null, title_text: 'Título A', dimensions: null },
      { id: 'v-b', label: 'B', is_original: false, blob_url: 'https://x/b.jpg', title_text: 'Título B', dimensions: null },
    ],
    v2, ...o,
  } as unknown as AbTestDetailView & { v2: Concl }
}
const FEITO: ResultadoAcaoSaida = { ok: true, resultado: 'feito', campos: {} }
const CAMPOS = [{ campo: 'title' as const, valor_atual: 'Título por fora' }, { campo: 'thumbnail' as const, valor_atual: 'https://x/fora.jpg' }]

beforeEach(() => { admin.value = true; refresh.mockClear() })
afterEach(() => cleanup())

function montar(v2: Concl, o: { aplicar?: ReturnType<typeof vi.fn>; voltar?: ReturnType<typeof vi.fn>; view?: Record<string, unknown> } = {}) {
  const aplicar = o.aplicar ?? vi.fn().mockResolvedValue(FEITO)
  const voltar = o.voltar ?? vi.fn().mockResolvedValue(FEITO)
  const r = render(<ConcluidoV2Detail view={view(v2, o.view)} aplicar={aplicar} voltar={voltar} />)
  return { ...r, aplicar, voltar }
}
const abrirAplicar = () => fireEvent.click(screen.getByRole('button', { name: 'Aplicar B ao vídeo' }))
const confirmar = (nome: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: nome }))

describe('T12 T7: concluído v2', () => {
  it('vencedor provisório: selo, prazo com data, cabeçalho com a data de conclusão', () => {
    const { container } = montar(base())
    expect(container.textContent).toContain('▲B vence (provisório)')
    expect(container.textContent).toContain('Provisório até 04/11: pode mudar nos próximos dias.')
    expect(container.textContent).toContain('Teste do Lab concluído em 24/10')
    expect(container.textContent).toContain('Quanto o teste alcançou')
    expect(container.textContent).toContain('No ar agora: A (original).')
  })

  it('item 5 (Yannis P1): provisório com data mostra "provisório até DD/MM" junto do botão', () => {
    montar(base())
    expect(screen.getByTestId('aplicar-provisorio').textContent).toBe('provisório até 04/11')
  })
  it('item 5: sem data (prazo vencido) ou final, o botão não mostra "provisório até"', () => {
    montar(base({ prazo: { tipo: 'provisorio', ate: null } }))
    expect(screen.queryByTestId('aplicar-provisorio')).toBeNull()
    cleanup()
    montar(base({ prazo: { tipo: 'final' }, selo: { tipo: 'vence', provisorio: false, letra: 'B' } }))
    expect(screen.queryByTestId('aplicar-provisorio')).toBeNull()
  })

  it('Aplicar abre o diálogo com foco em "Cancelar"; confirmar com feito: 1 chamada (idB, restoreSeq), refresh e foco na .noar', async () => {
    const { aplicar, container } = montar(base())
    abrirAplicar()
    const alerta = screen.getByRole('alertdialog')
    expect(alerta.textContent).toContain('Aplicar B ao vídeo?')
    expect(alerta.textContent).toContain('A miniatura muda agora no YouTube.')
    expect(alerta.textContent).toContain('O desfecho ainda é provisório.')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' })))
    confirmar('Aplicar B')
    await waitFor(() => expect(aplicar).toHaveBeenCalledTimes(1))
    expect(aplicar).toHaveBeenCalledWith('v-b', 7)
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(container.querySelector('.pv2-noar')))
  })

  it('2 cliques rápidos em confirmar: 1 chamada', async () => {
    let solta!: (r: ResultadoAcaoSaida) => void
    const aplicar = vi.fn(() => new Promise<ResultadoAcaoSaida>(res => { solta = res }))
    montar(base(), { aplicar })
    abrirAplicar()
    const b = screen.getByRole('button', { name: 'Aplicar B' })
    fireEvent.click(b); fireEvent.click(b)
    expect(aplicar).toHaveBeenCalledTimes(1)
    // o diálogo fecha e a página mostra a espera: botão aria-disabled, sem segundo disparo
    const espera = screen.getByRole('button', { name: 'Aplicando B…' })
    expect(espera.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(espera)
    expect(aplicar).toHaveBeenCalledTimes(1)
    await act(async () => { solta(FEITO) })
  })

  it('ja_encerrado: texto da ◆T 8 e nenhum sucesso', async () => {
    const aplicar = vi.fn().mockResolvedValue({ ok: false, resultado: 'ja_encerrado', error: 'x' })
    const { container } = montar(base(), { aplicar })
    abrirAplicar(); confirmar('Aplicar B')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('O teste mudou desde que você abriu a página. Recarregue para ver o estado atual.'))
    expect(refresh).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('B está no ar')
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('ja_encerrado por outro teste no vídeo: mostra o error da action', async () => {
    const aplicar = vi.fn().mockResolvedValue({ ok: false, resultado: 'ja_encerrado', error: MSG_OUTRO_TESTE })
    montar(base(), { aplicar })
    abrirAplicar(); confirmar('Aplicar B')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(MSG_OUTRO_TESTE))
  })

  it('mudou e erro mostram a mensagem da action', async () => {
    const aplicar = vi.fn().mockResolvedValue({ ok: false, resultado: 'mudou', error: MSG_MUDOU })
    montar(base(), { aplicar })
    abrirAplicar(); confirmar('Aplicar B')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(MSG_MUDOU))
  })

  it('precisa_confirmar: abre o diálogo de troca ("Aplicar B mesmo assim"), sem refresh nem "B está no ar"; confirmar chama com forcar', async () => {
    const aplicar = vi.fn()
      .mockResolvedValueOnce({ ok: true, resultado: 'precisa_confirmar', campos: CAMPOS })
      .mockResolvedValueOnce(FEITO)
    const { container } = montar(base(), { aplicar })
    abrirAplicar(); confirmar('Aplicar B')
    const mesmoAssim = await screen.findByRole('button', { name: 'Aplicar B mesmo assim' })
    expect(refresh).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain('B está no ar')
    // título e miniatura da opção no diálogo de troca
    const dlg = screen.getByRole('alertdialog')
    expect(dlg.textContent).toContain('Título B')
    expect(dlg.querySelector('img[alt="Thumbnail da variante B"]')).not.toBeNull()
    fireEvent.click(mesmoAssim); fireEvent.click(mesmoAssim)
    await waitFor(() => expect(aplicar).toHaveBeenCalledTimes(2))
    expect(aplicar).toHaveBeenNthCalledWith(2, 'v-b', 7, true)
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('2ª chamada com forcar devolvendo ja_encerrado: ◆T 8 no diálogo de troca, botão volta a habilitar, sem sucesso', async () => {
    const aplicar = vi.fn()
      .mockResolvedValueOnce({ ok: true, resultado: 'precisa_confirmar', campos: CAMPOS })
      .mockResolvedValueOnce({ ok: false, resultado: 'ja_encerrado', error: 'x' })
    montar(base(), { aplicar })
    abrirAplicar(); confirmar('Aplicar B')
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar B mesmo assim' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('O teste mudou desde que você abriu a página.'))
    expect((screen.getByRole('button', { name: 'Aplicar B mesmo assim' }) as HTMLButtonElement).disabled).toBe(false)
    expect(refresh).not.toHaveBeenCalled()
  })

  it('texto por tipo de teste (Gio 2): combo, título e miniatura no Aplicar e no Voltar', () => {
    const c = montar(base(), { view: { flag: 'combo' } })
    abrirAplicar()
    expect(screen.getByRole('alertdialog').textContent).toContain('A miniatura e o título mudam agora.')
    c.unmount(); cleanup()
    montar(base(), { view: { flag: 'title' } })
    abrirAplicar()
    expect(screen.getByRole('alertdialog').textContent).toContain('O título muda agora.')
    cleanup()
    const aplicada = base({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, aplicar: null, voltar: true })
    montar(aplicada, { view: { flag: 'combo', revertExpiresAt: em(3) } })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à original' }))
    expect(screen.getByRole('alertdialog').textContent).toContain('A miniatura e o título voltam a ser os de A agora no YouTube.')
    cleanup()
    montar(aplicada, { view: { flag: 'title', revertExpiresAt: em(3) } })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à original' }))
    expect(screen.getByRole('alertdialog').textContent).toContain('O título volta a ser o de A agora no YouTube.')
  })

  it('erro nos diálogos tem ícone (grid de 2 colunas não deixa o texto na coluna de 20px) — Aplicar e troca', async () => {
    const aplicar = vi.fn()
      .mockResolvedValueOnce({ ok: false, resultado: 'mudou', error: MSG_MUDOU })
    montar(base(), { aplicar })
    abrirAplicar(); confirmar('Aplicar B')
    await waitFor(() => expect(screen.getByRole('alert').querySelector('svg')).not.toBeNull())
    cleanup()
    const ap2 = vi.fn()
      .mockResolvedValueOnce({ ok: true, resultado: 'precisa_confirmar', campos: CAMPOS })
      .mockResolvedValueOnce({ ok: false, resultado: 'mudou', error: MSG_MUDOU })
    montar(base(), { aplicar: ap2 })
    abrirAplicar(); confirmar('Aplicar B')
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar B mesmo assim' }))
    await waitFor(() => expect(screen.getByRole('alert').querySelector('svg')).not.toBeNull())
  })

  it('diálogo de troca: ja_encerrado e exceção oferecem Recarregar (Y-T12-2)', async () => {
    for (const falha of [{ ok: false, resultado: 'ja_encerrado', error: 'x' }, new Error('rede')]) {
      const aplicar = vi.fn().mockResolvedValueOnce({ ok: true, resultado: 'precisa_confirmar', campos: CAMPOS })
      if (falha instanceof Error) aplicar.mockRejectedValueOnce(falha); else aplicar.mockResolvedValueOnce(falha)
      montar(base(), { aplicar })
      abrirAplicar(); confirmar('Aplicar B')
      fireEvent.click(await screen.findByRole('button', { name: 'Aplicar B mesmo assim' }))
      const rec = await screen.findByRole('button', { name: 'Recarregar' })
      refresh.mockClear(); fireEvent.click(rec)
      expect(refresh).toHaveBeenCalledTimes(1)
      cleanup()
    }
  })

  it('Voltar devolvendo precisa_confirmar: texto próprio da volta, com Recarregar (Logan f)', async () => {
    const voltar = vi.fn().mockResolvedValue({ ok: true, resultado: 'precisa_confirmar', campos: CAMPOS })
    montar(base({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, aplicar: null, voltar: true }), { voltar, view: { revertExpiresAt: em(3) } })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à original' }))
    confirmar('Sim, voltar à original')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Não consegui concluir a volta. Recarregue a página para ver o estado atual.'))
    expect(screen.getByRole('button', { name: 'Recarregar' })).toBeTruthy()
  })

  it('original vence: nenhum botão, nenhum %', () => {
    const { container } = montar(base({
      selo: { tipo: 'original' }, aplicar: null, prazo: { tipo: 'final' },
      frase: { principal: 'A original se saiu melhor; nada a aplicar.', apoio: 'A original segue no ar.' },
    }))
    expect(screen.queryByRole('button', { name: /Aplicar|Voltar à original/ })).toBeNull()
    expect(container.textContent).not.toContain('%')
    expect(container.textContent).toContain('■Final: já não muda.')
  })

  it('aplicado: "B está no ar", "Voltar à original" e, confirmado, voltar(restoreSeq)', async () => {
    const { voltar, container } = montar(base({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, aplicar: null, voltar: true }), { view: { revertExpiresAt: em(3) } })
    expect(container.textContent).toContain('B está no ar.')
    expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à original' }))
    const dlg = screen.getByRole('alertdialog')
    expect(dlg.textContent).toContain('Voltar à original (A)?')
    expect(dlg.textContent).toContain('A miniatura volta a ser a de A agora no YouTube.')
    expect(dlg.textContent).toContain('O resultado do teste não muda e continua visível aqui.')
    confirmar('Sim, voltar à original')
    await waitFor(() => expect(voltar).toHaveBeenCalledWith(7))
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
  })

  it('aplicado e desfecho mudou (outra/sem diferença): Voltar à original, nunca Aplicar, apoio da ◆T 7/7b', () => {
    montar(base({
      selo: { tipo: 'sem_diferenca' }, noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: true }, aplicar: null, voltar: true,
      frase: { principal: 'Agora C parece melhor; ao encerrar, B parecia melhor.', apoio: null },
    }), { view: { revertExpiresAt: em(3) } })
    expect(screen.getByRole('button', { name: 'Voltar à original' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull()
    expect(document.body.textContent).toContain('Agora C parece melhor; ao encerrar, B parecia melhor.')
  })

  it('janela vencida na aba: ◆T 14, 0 chamadas', () => {
    const { voltar } = montar(base({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, aplicar: null, voltar: true }), { view: { revertExpiresAt: em(-1) } })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar à original' }))
    confirmar('Sim, voltar à original')
    expect(screen.getByRole('alert').textContent).toContain('O prazo de 7 dias para voltar acabou.')
    expect(voltar).not.toHaveBeenCalled()
    expect(screen.queryByText('Tentar de novo')).toBeNull()
  })

  it('desfeita sem botão (desfecho mudou): "No ar agora: A (original). B deixou de ser aplicada." e selo atual', () => {
    const { container } = montar(base({ noAr: { tipo: 'desfeita', letra: 'B', desfechoMudou: true }, aplicar: null, selo: { tipo: 'sem_diferenca' }, frase: { principal: 'Sem diferença clara entre A e B.', apoio: null } }))
    expect(container.textContent).toContain('No ar agora: A (original). B deixou de ser aplicada.')
    expect(container.textContent).toContain('Aplicação de B desfeita')
    expect(container.textContent).toContain('=Sem diferença')
    expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull()
  })

  describe('selo depois do Voltar (aplicação desfeita)', () => {
    const desf = (o: Partial<Concl> = {}): Concl => base({
      noAr: { tipo: 'desfeita', letra: 'B', desfechoMudou: false }, aplicar: null, aplicarDeNovo: { variant_id: 'v-b', letra: 'B' },
      frase: { principal: 'B ainda parece melhor, mas a original está no ar.', apoio: 'CTR ≈ 5,4% contra 4,6% de A (+17,4% vs A).', complemento: 'Você voltou à original. Pode aplicar B de novo.' },
      ...o,
    })
    const abrirDeNovo = () => fireEvent.click(screen.getByRole('button', { name: 'Aplicar B de novo' }))

    it('ordem: região aria-live persistente com ◆ desfeita (cheio) antes do ◇ neutro; ◇ no passado e provisório', () => {
      const { container } = montar(desf())
      const reg = container.querySelector('[aria-live="polite"]')!
      const selos = Array.from(reg.querySelectorAll('.pv2-sel'))
      expect(selos.map(x => x.textContent)).toEqual(['Aplicação de B desfeita', 'B venceu o teste · provisório'])
      expect(selos[0]!.className).toContain('desfeito')
      expect(selos[1]!.className).toContain('neu')
      expect(selos.every(x => x.querySelector('svg[width="14"][height="14"]') !== null)).toBe(true)
      expect(container.querySelector('[role="status"]')).toBeNull()
      expect(container.querySelector('.pv2-sel.vence')).toBeNull()
    })
    it('final: ◇ "B venceu o teste" sem "provisório"', () => {
      const { container } = montar(desf({ selo: { tipo: 'vence', provisorio: false, letra: 'B' }, prazo: { tipo: 'final' } }))
      expect(Array.from(container.querySelectorAll('.pv2-sel')).map(x => x.textContent)).toEqual(['Aplicação de B desfeita', 'B venceu o teste'])
      expect(container.textContent).toContain('Final: já não muda.')
    })
    it('frase, CTR e apoio na ordem; botão secundário (nunca pri)', () => {
      const { container } = montar(desf())
      const sum = container.querySelector('.pv2-sum')!
      expect(sum.firstChild!.textContent).toBe('B ainda parece melhor, mas a original está no ar.')
      expect(Array.from(sum.querySelectorAll('small')).map(x => x.textContent)).toEqual(['CTR ≈ 5,4% contra 4,6% de A (+17,4% vs A).', 'Você voltou à original. Pode aplicar B de novo.'])
      const b = screen.getByRole('button', { name: 'Aplicar B de novo' })
      expect(b.className).not.toContain('pri')
      expect(screen.queryByTestId('aplicar-provisorio')).toBeNull()
    })
    it('diálogo provisório: título, janela de 7 dias e desfecho provisório; Cancelar fecha; confirmar chama aplicar com a variante real', async () => {
      const { aplicar } = montar(desf())
      abrirDeNovo()
      const d = screen.getByRole('alertdialog')
      expect(d.textContent).toContain('Aplicar B de novo?')
      expect(d.textContent).toContain('O desfecho ainda é provisório. A janela de 7 dias para voltar recomeça hoje.')
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(screen.queryByRole('alertdialog')).toBeNull()
      abrirDeNovo(); confirmar('Aplicar B')
      await waitFor(() => expect(aplicar).toHaveBeenCalledWith('v-b', 7))
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
    })
    it('diálogo final: "Este desfecho já não muda."', () => {
      montar(desf({ selo: { tipo: 'vence', provisorio: false, letra: 'B' }, prazo: { tipo: 'final' } }))
      abrirDeNovo()
      const d = screen.getByRole('alertdialog')
      expect(d.textContent).toContain('Este desfecho já não muda. A janela de 7 dias para voltar recomeça hoje.')
      expect(d.textContent).not.toContain('provisório')
    })
    it('letra da variante real (C), não fixa B', () => {
      montar(desf({
        selo: { tipo: 'vence', provisorio: false, letra: 'C' }, noAr: { tipo: 'desfeita', letra: 'C', desfechoMudou: false },
        aplicarDeNovo: { variant_id: 'v-c', letra: 'C' },
      }))
      expect(screen.getByRole('button', { name: 'Aplicar C de novo' })).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Aplicar C de novo' }))
      expect(screen.getByRole('alertdialog').textContent).toContain('Aplicar C de novo?')
    })
    it('espera: "Aplicando B…" aria-disabled e sem segunda chamada', async () => {
      let solta!: (r: ResultadoAcaoSaida) => void
      const aplicar = vi.fn(() => new Promise<ResultadoAcaoSaida>(res => { solta = res }))
      montar(desf(), { aplicar })
      abrirDeNovo(); confirmar('Aplicar B')
      const b = await screen.findByRole('button', { name: 'Aplicando B…' })
      expect(b.getAttribute('aria-disabled')).toBe('true')
      fireEvent.click(b)
      expect(aplicar).toHaveBeenCalledTimes(1)
      await act(async () => { solta(FEITO) })
    })
    it('erro do servidor: role=alert com "Não consegui aplicar B. A original continua no ar." e Tentar de novo repete', async () => {
      const aplicar = vi.fn().mockResolvedValueOnce({ ok: false, resultado: 'erro', error: MSG_FALHA_SAIDA }).mockResolvedValueOnce(FEITO)
      montar(desf(), { aplicar })
      abrirDeNovo(); confirmar('Aplicar B')
      const alerta = await screen.findByRole('alert')
      expect(alerta.textContent).toContain('Não consegui aplicar B. A original continua no ar.')
      expect(screen.queryByRole('alertdialog')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
      await waitFor(() => expect(aplicar).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    })
    it('Voltar: espera "Voltando à original…" e erro "Não consegui voltar à original. B continua no ar." com Tentar de novo', async () => {
      const voltar = vi.fn().mockResolvedValueOnce({ ok: false, resultado: 'erro', error: MSG_FALHA_SAIDA }).mockResolvedValueOnce(FEITO)
      montar(base({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, aplicar: null, voltar: true }), { voltar, view: { revertExpiresAt: em(3) } })
      fireEvent.click(screen.getByRole('button', { name: 'Voltar à original' }))
      confirmar('Sim, voltar à original')
      const alerta = await screen.findByRole('alert')
      expect(alerta.textContent).toContain('Não consegui voltar à original. B continua no ar.')
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
      await waitFor(() => expect(voltar).toHaveBeenCalledTimes(2))
    })
    it('C2: a ação lançou (rede/timeout): texto neutro com Recarregar, nunca "continua no ar", sem Tentar de novo', async () => {
      for (const tipo of ['aplicar', 'voltar'] as const) {
        const rej = vi.fn().mockRejectedValue(new Error('timeout'))
        if (tipo === 'aplicar') { montar(desf(), { aplicar: rej }); abrirDeNovo(); confirmar('Aplicar B') }
        else {
          montar(base({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, aplicar: null, voltar: true }), { voltar: rej, view: { revertExpiresAt: em(3) } })
          fireEvent.click(screen.getByRole('button', { name: 'Voltar à original' })); confirmar('Sim, voltar à original')
        }
        const alerta = await screen.findByRole('alert')
        expect(alerta.textContent).toContain('Sem resposta do servidor. Recarregue para ver o que está no ar.')
        expect(alerta.textContent).not.toContain('continua no ar')
        expect(within(alerta).getByRole('button', { name: 'Recarregar' })).toBeTruthy()
        expect(within(alerta).queryByRole('button', { name: 'Tentar de novo' })).toBeNull()
        cleanup()
      }
    })
    it.each([
      ['mudou', { ok: false, resultado: 'mudou', error: MSG_MUDOU }, 'Recarregar'],
      ['ja_encerrado', { ok: false, resultado: 'ja_encerrado', error: MSG_JA_ENCERRADO }, 'Recarregar'],
      ['ja_encerrado por outro teste', { ok: false, resultado: 'ja_encerrado', error: MSG_OUTRO_TESTE }, 'Recarregar'],
      ['em_andamento', { ok: false, resultado: 'em_andamento', error: MSG_EM_ANDAMENTO }, 'Tentar de novo'],
      ['sem_permissao', { ok: false, resultado: 'sem_permissao', error: 'Sem permissão.' }, 'Recarregar'],
    ])('C1: %s na página deixa um botão no alert', async (_n, resp, botao) => {
      montar(desf(), { aplicar: vi.fn().mockResolvedValue(resp) })
      abrirDeNovo(); confirmar('Aplicar B')
      const alerta = await screen.findByRole('alert')
      expect(within(alerta).getByRole('button', { name: botao })).toBeTruthy()
    })
    it('C1: prazo do Voltar vencido deixa Recarregar no alert', () => {
      montar(base({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, aplicar: null, voltar: true }), { view: { revertExpiresAt: em(-1) } })
      fireEvent.click(screen.getByRole('button', { name: 'Voltar à original' })); confirmar('Sim, voltar à original')
      expect(within(screen.getByRole('alert')).getByRole('button', { name: 'Recarregar' })).toBeTruthy()
    })
    it('M1: erro da leitura velha some quando o restoreSeq muda (refresh)', async () => {
      const aplicar = vi.fn().mockResolvedValue({ ok: false, resultado: 'mudou', error: MSG_MUDOU })
      const { rerender, voltar } = montar(desf(), { aplicar })
      abrirDeNovo(); confirmar('Aplicar B')
      await screen.findByRole('alert')
      rerender(<ConcluidoV2Detail view={view(desf(), { restoreSeq: 8 })} aplicar={aplicar} voltar={voltar} />)
      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    })
    it('sem_leitura: sem botão e motivo próprio (não diz que há outro teste)', () => {
      const { container } = montar(desf({
        aplicarDeNovo: null, bloqueio: 'sem_leitura',
        frase: { principal: 'B ainda parece melhor, mas a original está no ar.', apoio: null, complemento: 'Você voltou à original.' },
      }))
      expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull()
      expect(container.textContent).toContain('Não deu para conferir se há outro teste neste vídeo. Recarregue a página.')
      expect(container.textContent).not.toContain('Há outro teste aberto')
    })
    it('bloqueado por outro teste: sem botão, motivo com a emenda do dono; apoio sem "Pode aplicar"', () => {
      const { container } = montar(desf({
        aplicarDeNovo: null, bloqueio: 'outro_teste',
        frase: { principal: 'B ainda parece melhor, mas a original está no ar.', apoio: null, complemento: 'Você voltou à original.' },
      }))
      expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull()
      expect(container.textContent).toContain('Há outro teste aberto neste vídeo. Encerre ou aguarde o outro teste.')
      expect(container.textContent).not.toContain('Pode aplicar')
    })
    it('sem admin: nota de permissão no lugar do botão', () => {
      admin.value = false
      montar(desf())
      expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull()
      expect(screen.getByTestId('admin-only-note')).toBeTruthy()
    })
  })

  it('noAr desconhecido: sem a linha "No ar agora"', () => {
    const { container } = montar(base({ noAr: { tipo: 'desconhecido' }, aplicar: null }))
    expect(container.textContent).not.toContain('No ar agora')
    expect(container.textContent).not.toContain('está no ar')
  })

  it('ilegível: "Tentar de novo" recarrega', () => {
    const { container } = montar(base({
      selo: { tipo: 'ilegivel' }, tentarDeNovo: true, prazo: null, aplicar: null, pisos: null,
      frase: { principal: 'Não consegui ler o desfecho deste teste.', apoio: 'Os números abaixo são os gravados. Nada foi alterado.' },
    }))
    expect(container.textContent).toContain('⚠Não consegui ler')
    expect(container.textContent).not.toContain('Quanto o teste alcançou')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('sem admin: sem botão, com a nota de permissão', () => {
    admin.value = false
    montar(base())
    expect(screen.queryByRole('button', { name: /Aplicar/ })).toBeNull()
    expect(screen.getByTestId('admin-only-note')).toBeTruthy()
  })

  it('Esc fecha o diálogo e devolve o foco ao gatilho', async () => {
    montar(base())
    const gatilho = screen.getByRole('button', { name: 'Aplicar B ao vídeo' })
    gatilho.focus()
    abrirAplicar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toBeTruthy())
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(document.activeElement).toBe(gatilho)
  })

  it('concluído v2 com pulado_drift: noAr desconhecido e a faixa de restauração existente aparece', () => {
    const v = view(base({ noAr: { tipo: 'desconhecido' } }), {
      restoreStatus: { thumbnail: { estado: 'pulado_drift', em: '2026-10-24T12:00:00Z', valor_atual: 'x' } },
    })
    const f = faixaDaPagina(v, { thumbnail: { estado: 'pulado_drift', em: '2026-10-24T12:00:00Z' } }, new Date())
    expect(f.faixa).not.toBeNull()
  })
})

describe('T12 T7: modelo sem aplicar para noAr desconhecido', () => {
  it('telaV2DoTeste é a fonte: pulado_drift ⇒ desconhecido', () => {
    const t = telaV2DoTeste({
      teste: {
        id: 't1', status: 'completed', regra: 'v2', config: {}, paused_at: null, completed_at: '2026-10-24T12:00:00Z', completed_reason: 'manual_winner',
        winner_variant_id: 'v-b', winner_applied_at: null, revert_expires_at: null, restore_status: { thumbnail: { estado: 'pulado_drift', em: 'x' } },
        result_metadata: { v2: { desfecho: 'vencedor_provavel', vencedor_sugerido: 'v-b', encerrado_em_dia: '2026-10-24', provisorio: false, n: 100 } },
        original_title: 'x', test_type: 'thumbnail',
      },
      variantes: [{ id: 'v-a', letra: 'A', titulo: 'a', is_original: true }, { id: 'v-b', letra: 'B', titulo: 'b', is_original: false }],
      ciclos: [], dias: [], agora: new Date('2026-10-25T12:00:00Z'), outroTesteAberto: false,
    })
    expect(t && t.fase === 'concluido' && t.noAr.tipo).toBe('desconhecido')
  })
})
