// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'

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
  prazo: { tipo: 'provisorio', ate: '04/11' }, noAr: { tipo: 'original' }, aplicar: { variant_id: 'v-b', letra: 'B' }, aplicarDeNovo: null, bloqueio: null,
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
    placar: null, faixa_dias: [], completedAt: '2026-10-24T12:00:00Z', noArAgora: null, activeNow: null,
    variantDb: [
      { id: 'v-a', label: 'A', is_original: true, blob_url: null, title_text: 'Título A', dimensions: null },
      { id: 'v-b', label: 'B', is_original: false, blob_url: 'https://x/b.jpg', title_text: 'Título B', dimensions: null },
    ],
    v2, ...o,
  } as unknown as AbTestDetailView & { v2: Concl }
}

beforeEach(() => { admin.value = true; refresh.mockClear() })
afterEach(() => cleanup())

const abrirAplicar = () => fireEvent.click(screen.getByRole('button', { name: 'Aplicar B ao vídeo' }))
const confirmar = (nome: string | RegExp) => fireEvent.click(screen.getByRole('button', { name: nome }))
function montar(v2: Concl, o: { view?: Record<string, unknown> } = {}) {
  return render(<ConcluidoV2Detail view={view(v2, o.view)} />)
}
const escolher = () => screen.queryByRole('link', { name: 'Escolher o que fica' })

describe('T12 T7 + M7b T15: concluído v2 sem prazo', () => {
  it('vencedor provisório: selo, prazo com data, cabeçalho com a data de conclusão', () => {
    const { container } = montar(base())
    expect(container.textContent).toContain('▲B vence (provisório)')
    expect(container.textContent).toContain('Provisório até 04/11: pode mudar nos próximos dias.')
    expect(container.textContent).toContain('Concluído em 24/10')
    expect(container.textContent).toContain('Quanto o teste alcançou')
    expect(container.textContent).toContain('No ar agora: A (original).')
  })

  it('T15: "Escolher o que fica" abre o painel do Lab para este teste; não há Aplicar, Voltar nem diálogo', () => {
    const { container } = montar(base())
    expect(escolher()!.getAttribute('href')).toBe('/cms/youtube/ab-lab?painel=t1')
    expect(screen.queryByRole('button', { name: /Aplicar|Voltar/ })).toBeNull()
    expect(screen.queryByTestId('aplicar-provisorio')).toBeNull()
    expect(container.textContent).not.toMatch(/Voltar até|Aplicar até|Aplicar B|Voltar à original/)
  })

  it('T15: o botão vale para qualquer concluído v2, aplicado, desfeito, original vence ou sem diferença', () => {
    const casos: Concl[] = [
      base({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, aplicar: null }),
      base({ noAr: { tipo: 'desfeita', letra: 'B', desfechoMudou: true }, aplicar: null, selo: { tipo: 'sem_diferenca' } }),
      base({ selo: { tipo: 'original' }, aplicar: null, prazo: { tipo: 'final' } }),
      base({ selo: { tipo: 'sem_diferenca' }, aplicar: null }),
    ]
    for (const c of casos) {
      montar(c)
      expect(escolher()).toBeTruthy()
      cleanup()
    }
  })

  it('aplicado: "B está no ar"', () => {
    const { container } = montar(base({ noAr: { tipo: 'aplicada', letra: 'B', desfechoMudou: false }, aplicar: null }))
    expect(container.textContent).toContain('B está no ar.')
  })

  it('desfeita (desfecho mudou): "No ar agora: A (original). B deixou de ser aplicada." e selo atual', () => {
    const { container } = montar(base({ noAr: { tipo: 'desfeita', letra: 'B', desfechoMudou: true }, aplicar: null, selo: { tipo: 'sem_diferenca' }, frase: { principal: 'Sem diferença clara entre A e B.', apoio: null } }))
    expect(container.textContent).toContain('No ar agora: A (original). B deixou de ser aplicada.')
    expect(container.textContent).toContain('Aplicação de B desfeita')
    expect(container.textContent).toContain('=Sem diferença')
  })

  it('original vence: sem %, prazo final', () => {
    const { container } = montar(base({
      selo: { tipo: 'original' }, aplicar: null, prazo: { tipo: 'final' },
      frase: { principal: 'A original se saiu melhor; nada a aplicar.', apoio: 'A original segue no ar.' },
    }))
    expect(container.textContent).not.toContain('%')
    expect(container.textContent).toContain('■Final: já não muda.')
  })

  describe('selo depois do Voltar (aplicação desfeita)', () => {
    const desf = (o: Partial<Concl> = {}): Concl => base({
      noAr: { tipo: 'desfeita', letra: 'B', desfechoMudou: false }, aplicar: null, aplicarDeNovo: { variant_id: 'v-b', letra: 'B' },
      frase: { principal: 'B ainda parece melhor, mas a original está no ar.', apoio: 'CTR ≈ 5,4% contra 4,6% de A (+17,4% vs A).', complemento: 'Você voltou à original. Pode aplicar B de novo.' },
      ...o,
    })
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
    it('frase, CTR e apoio na ordem', () => {
      const { container } = montar(desf())
      const sum = container.querySelector('.pv2-sum')!
      expect(sum.firstChild!.textContent).toBe('B ainda parece melhor, mas a original está no ar.')
      expect(Array.from(sum.querySelectorAll('small')).map(x => x.textContent)).toEqual(['CTR ≈ 5,4% contra 4,6% de A (+17,4% vs A).', 'Você voltou à original. Pode aplicar B de novo.'])
    })
    it('sem_leitura: sem botão e motivo próprio (não diz que há outro teste)', () => {
      const { container } = montar(desf({ aplicarDeNovo: null, bloqueio: 'sem_leitura' }))
      expect(escolher()).toBeNull()
      expect(container.textContent).toContain('Não deu para conferir se há outro teste neste vídeo. Recarregue a página.')
      expect(container.textContent).not.toContain('Há outro teste aberto')
    })
    it('bloqueado por outro teste: sem botão, motivo com a emenda do dono', () => {
      const { container } = montar(desf({ aplicarDeNovo: null, bloqueio: 'outro_teste' }))
      expect(escolher()).toBeNull()
      expect(container.textContent).toContain('Há outro teste aberto neste vídeo. Encerre ou aguarde o outro teste.')
    })
  })

  it('noAr desconhecido: sem a linha "No ar agora"', () => {
    const { container } = montar(base({ noAr: { tipo: 'desconhecido' }, aplicar: null }))
    expect(container.textContent).not.toContain('No ar agora')
    expect(container.textContent).not.toContain('está no ar')
  })

  it('ilegível: "Tentar de novo" recarrega e não há "Escolher o que fica"', () => {
    const { container } = montar(base({
      selo: { tipo: 'ilegivel' }, tentarDeNovo: true, prazo: null, aplicar: null, pisos: null,
      frase: { principal: 'Não consegui ler o desfecho deste teste.', apoio: 'Os números abaixo são os gravados. Nada foi alterado.' },
    }))
    expect(container.textContent).toContain('⚠Não consegui ler')
    expect(container.textContent).not.toContain('Quanto o teste alcançou')
    expect(escolher()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('sem admin: sem o link, com a nota de permissão', () => {
    admin.value = false
    montar(base())
    expect(escolher()).toBeNull()
    expect(screen.getByTestId('admin-only-note')).toBeTruthy()
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
