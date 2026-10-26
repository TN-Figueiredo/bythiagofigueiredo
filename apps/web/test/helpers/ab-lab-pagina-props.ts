// Props mínimas e completas do AbLabDashboard novo (M7 T11), para os testes de tela. Sem mock de módulo aqui.
import { vi } from 'vitest'
import { AB_SITE_SETTINGS_DEFAULTS } from '@/lib/youtube/ab-types'
import type { AbLabDashboardProps } from '@/app/cms/(authed)/youtube/ab-lab/_components/ab-lab-dashboard'
import type { AcoesCaminho } from '@/app/cms/(authed)/youtube/ab-lab/_components/caminho-nativo/lista-caminho'
import type { PaginaDoLab } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { PaginaDoCanal } from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'

export const paginaVazia = (o: Partial<PaginaDoLab> = {}): PaginaDoLab => ({
  topo: { frase: 'Nenhum teste ainda. Crie o primeiro quando quiser.' },
  comVoce: { itens: [], vazio: null },
  emTeste: [],
  concluidos: { linhas: [], total: 0, regua: { feitos: 0, meta: 3 } },
  temHistorico: false,
  ...o,
})

export const listaDe = (linhas: LinhaDoCaminho[] = []): PaginaDoCanal => ({
  linhas,
  contagem: { testaveis: linhas.length, semVolume: 0, naoLido: 0, total: linhas.length, motivoNaoLido: null },
  totalDoFiltro: linhas.length, temMais: false, restantes: 0, extrasForaDoFiltro: 0, truncado: false, filtroEfetivo: 'testaveis',
})

export function propsDoLab(o: Partial<AbLabDashboardProps> = {}): AbLabDashboardProps {
  return {
    pagina: paginaVazia(),
    settings: { ...AB_SITE_SETTINGS_DEFAULTS },
    siteId: 's',
    eligibleVideos: [],
    drafts: [],
    iniciarTeste: vi.fn(),
    acoesDecisao: { encerrar: vi.fn(), aplicarSugerido: vi.fn(), voltar: vi.fn() },
    acoesCaminho: { jaIniciei: vi.fn(), responderTesteDoYouTube: vi.fn(), mudarRespostaDoTesteDoYouTube: vi.fn() } as unknown as AcoesCaminho,
    lerVideos: vi.fn(),
    salvarAjustes: vi.fn(async () => ({ ok: true })),
    listaInicial: listaDe(),
    videoInicial: null,
    learnings: null,
    channelLearnings: null,
    ...o,
  }
}
