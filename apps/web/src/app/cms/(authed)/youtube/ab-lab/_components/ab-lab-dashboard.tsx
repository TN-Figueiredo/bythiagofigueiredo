'use client'

// Página do A/B Lab na ordem nova (M7 T11): topo com a frase, Com você, Em teste agora, Sugestões, Concluídos e Vídeos do canal.
// Tudo vem do modelo `pagina` (leitura única do servidor). Nenhuma action é importada aqui: elas chegam por props.
import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Filter, Settings, ImageIcon } from 'lucide-react'
import type {
  AbTestDraft,
  AbTestSiteSettings,
  ChannelLearningsData,
  LearningsData,
  TestType,
} from '@/lib/youtube/ab-types'
import { SettingsDrawer } from './settings-drawer'
import { VideoPickerDialog } from './video-picker-dialog'
import type { EligibleVideo } from './video-picker-dialog'
import { AbCreateWizard, type IniciarTeste, type LerAvisoDeVolume } from './ab-create-wizard'
import type { WizardVideo } from './ab-create-wizard'
import type { PaginaDoLab, PainelDecisao, CartaoEmTeste } from '@/lib/youtube/ab-lab-pagina/tipos'
import type { PaginaDoCanal } from '@/lib/youtube/teste-youtube/nativo/lista-borda'
import type { LinhaDoCaminho } from '@/lib/youtube/teste-youtube/nativo/lista'
import { ContextoAssistente, useControleAssistente } from './caminho-nativo/assistente-contexto'
import { ListaErro } from './caminho-nativo/lista-erro'
import type { AcoesCaminho } from './caminho-nativo/lista-caminho'
import { FaixaComVoce } from './pagina/faixa-com-voce'
import { SecaoEmTeste } from './pagina/secao-em-teste'
import { SecaoConcluidos } from './pagina/secao-concluidos'
import { PainelOQueFica, type AcoesDecisao } from './pagina/painel-o-que-fica'
import { DialogoDia14 } from './pagina/dialogo-dia-14'
import { VideosDoCanal, type VideosDoCanalProps } from './pagina/videos-do-canal'
import './pagina/pagina-lab.css'

export interface AbLabDashboardProps {
  pagina: PaginaDoLab
  settings: AbTestSiteSettings
  siteId: string
  eligibleVideos: EligibleVideo[]
  drafts: AbTestDraft[]
  /** `startAbTest` vem da página (servidor): o assistente não importa a action. */
  iniciarTeste: IniciarTeste
  avisoDeVolume?: LerAvisoDeVolume
  acoesDecisao: AcoesDecisao
  acoesCaminho: AcoesCaminho
  lerVideos: VideosDoCanalProps['ler']
  /** `updateAbSiteSettings` vem da página (servidor): o client não importa a action. */
  salvarAjustes: (changes: Partial<AbTestSiteSettings>) => Promise<{ ok: boolean; error?: string }>
  listaInicial: PaginaDoCanal
  videoInicial: string | null
  /** Bloco "Sugestões" (servidor, dentro de Suspense). */
  blocoSugestoes?: ReactNode
  learnings: LearningsData | null
  channelLearnings: ChannelLearningsData | null
}

const TIPO_ROTULO: Record<TestType, string> = { thumbnail: 'Miniatura', title: 'Título', combo: 'Título e miniatura' }
const TYPE_FILTER_LABELS: Record<'all' | TestType, string> = {
  all: 'Todos os tipos',
  thumbnail: 'Miniatura',
  title: 'Título',
  combo: 'Título e miniatura',
}

const tipoDoCartao = (c: CartaoEmTeste): TestType => (c.tipo === 'lab' ? c.card.type : 'title')

export function AbLabDashboard({
  pagina, settings, siteId, eligibleVideos, drafts, iniciarTeste, avisoDeVolume, acoesDecisao, acoesCaminho, lerVideos, salvarAjustes,
  listaInicial, videoInicial, blocoSugestoes, learnings, channelLearnings,
}: AbLabDashboardProps) {
  const router = useRouter()
  const [showSettings, setShowSettings] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [wizardVideo, setWizardVideo] = useState<WizardVideo | null>(null)
  const [continueDraft, setContinueDraft] = useState<AbTestDraft | null>(null)
  const [typeFilter, setTypeFilter] = useState<'all' | TestType>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [painel, setPainel] = useState<{ dados: PainelDecisao; origem: HTMLElement | null } | null>(null)
  const [dia14, setDia14] = useState<{ linha: LinhaDoCaminho; origem: HTMLElement | null } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  // Guarda D-8: UMA função (`abrirAssistente`) para as portas do "Iniciar teste" do nosso; `handleContinueDraft` abre direto.
  // A página já chega com a lista (leitura única): não há estado "carregando" a esperar.
  const assistente = useControleAssistente({ onAbrir: setWizardVideo, atualizar: () => router.refresh(), comLista: false })
  const { abrirAssistente, registrarLinhas } = assistente
  // As linhas da 1ª página alimentam a guarda mesmo com "Vídeos do canal" recolhido ou vazio.
  useEffect(() => { registrarLinhas(listaInicial.linhas, { substituir: true }) }, [listaInicial, registrarLinhas])

  const filtrarTipo = (t: string | TestType): boolean => typeFilter === 'all' || t === typeFilter || t === TIPO_ROTULO[typeFilter]
  const emTeste = pagina.emTeste.filter(c => filtrarTipo(tipoDoCartao(c)))
  const concluidos = typeFilter === 'all'
    ? pagina.concluidos
    : { ...pagina.concluidos, linhas: pagina.concluidos.linhas.filter(l => filtrarTipo(l.tipo)) }

  function abrirPainel(p: PainelDecisao, origem: HTMLElement): void {
    setAviso(null)
    setPainel({ dados: p, origem })
  }
  function fecharPainel(): void {
    const origem = painel?.origem ?? null
    setPainel(null)
    origem?.focus()
  }
  function abrirDia14(linha: LinhaDoCaminho, origem: HTMLElement): void { setDia14({ linha, origem }) }
  function fecharDia14(): void {
    const origem = dia14?.origem ?? null
    setDia14(null)
    origem?.focus()
  }
  // A linha VIVA: depois de responder a página relê e a linha muda (a resposta tem de citar o `updatedAt` novo, ou "Mudar resposta" é recusada).
  const linhaDia14 = dia14
    ? (listaInicial.linhas.find(l => l.videoId === dia14.linha.videoId) ?? dia14.linha)
    : null

  function handleContinueDraft(id: string) {
    const draft = drafts.find(d => d.id === id)
    if (!draft) return
    setContinueDraft(draft)
    setWizardVideo({
      id: draft.videoId,
      title: draft.name,
      thumbnailUrl: draft.thumbUrl,
      sourcePipelineId: draft.sourcePipelineId,
    })
  }

  function handleVideoPicked(video: WizardVideo) {
    setShowPicker(false)
    abrirAssistente(video)
  }

  async function handleSaveSettings(changes: Partial<AbTestSiteSettings>) {
    const result = await salvarAjustes(changes)
    if (!result.ok) throw new Error(result.error ?? 'Failed to save settings')
  }

  return (
    <ContextoAssistente.Provider value={assistente}>
    <div data-dashboard-root className="animate-ab-fade-up">
      {/* 1. Topo */}
      <div className="lab-pg flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="m-0 text-[30px] font-semibold leading-[1.15]" style={{ fontFamily: 'Georgia, serif' }}>A/B Lab</h1>
          <p className="resumo m-0 mt-2.5 max-w-[60ch] text-[21px] font-semibold leading-[1.35]" style={{ fontFamily: 'Georgia, serif', textWrap: 'balance' }}>{pagina.topo.frase}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/cms/youtube/ab-lab/library"
            className="lab-btn lab-alvo"
          >
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            Biblioteca
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen(prev => !prev)}
              aria-haspopup="true"
              aria-expanded={filterOpen}
              className="lab-btn lab-alvo"
            >
              <Filter size={14} aria-hidden="true" />
              {TYPE_FILTER_LABELS[typeFilter]}
            </button>
            {filterOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-[10px] border border-cms-border shadow-lg"
                style={{ background: 'var(--cms-surface)' }}
              >
                {(Object.keys(TYPE_FILTER_LABELS) as Array<'all' | TestType>).map(key => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { setTypeFilter(key); setFilterOpen(false) }}
                    className="w-full min-h-11 cursor-pointer px-3 py-2 text-left text-[13px] transition-colors hover:bg-cms-surface-hover"
                    style={{
                      color: key === typeFilter ? 'var(--cms-accent)' : 'var(--cms-text)',
                      fontWeight: key === typeFilter ? 600 : 400,
                      background: 'transparent',
                      border: 'none',
                      fontFamily: 'inherit',
                    }}
                  >
                    {TYPE_FILTER_LABELS[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label="Configurações"
            className="lab-btn lab-alvo"
          >
            <Settings size={14} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Ajustes</span>
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="lab-btn pri lab-alvo"
          >
            <Plus size={16} aria-hidden="true" />
            Novo teste
          </button>
        </div>
      </div>
      {aviso ? <p className="lab-pg lab-aviso" role="status">{aviso}</p> : null}

      {/* 2. Com você */}
      <div data-secao="com-voce">
        <FaixaComVoce
          itens={pagina.comVoce.itens}
          vazio={pagina.comVoce.vazio}
          onAbrirPainel={abrirPainel}
          onAbrirDia14={abrirDia14}
          onContinuarRascunho={handleContinueDraft}
          onNovoTeste={() => setShowPicker(true)}
          onAbrirTeste={id => router.push(`/cms/youtube/ab-lab/${id}`)}
        />
      </div>

      {/* 3. Em teste agora */}
      {emTeste.length > 0 && (
        <div data-secao="em-teste">
          <SecaoEmTeste cartoes={emTeste} onAbrirPainel={abrirPainel} onAbrirDia14={abrirDia14} />
        </div>
      )}

      {/* 4. Sugestões (servidor, em Suspense) */}
      {blocoSugestoes ? <div data-secao="sugestoes" className="lab-pg mt-7 empty:hidden">{blocoSugestoes}</div> : null}

      {/* 5. Concluídos */}
      <SecaoConcluidos
        concluidos={concluidos}
        temHistorico={pagina.temHistorico}
        learnings={learnings}
        channelLearnings={channelLearnings}
        onAbrirPainel={abrirPainel}
      />

      {/* 6. Vídeos do canal (recolhido) */}
      <div data-secao="videos-do-canal">
        <ListaErro>
          <VideosDoCanal inicial={listaInicial} videoInicial={videoInicial} acoes={acoesCaminho} ler={lerVideos} />
        </ListaErro>
      </div>

      {/* Diálogos, fora do fluxo */}
      {painel && <PainelOQueFica painel={painel.dados} acoes={acoesDecisao} onFechar={fecharPainel} onAviso={setAviso} />}
      {dia14 && linhaDia14 && (
        <DialogoDia14
          linha={linhaDia14}
          acoes={acoesCaminho}
          atualizar={() => router.refresh()}
          onFechar={fecharDia14}
        />
      )}

      {showSettings && (
        <SettingsDrawer
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showPicker && (
        <VideoPickerDialog
          eligibleVideos={eligibleVideos}
          onSelect={handleVideoPicked}
          onContinuarRascunho={(draftId) => { setShowPicker(false); if (drafts.some(d => d.id === draftId)) handleContinueDraft(draftId); else router.push(`/cms/youtube/ab-lab/new?draft=${draftId}`) }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {wizardVideo && (
        <AbCreateWizard
          key={continueDraft?.id ?? wizardVideo.id}
          video={wizardVideo}
          siteId={siteId}
          settings={settings}
          onClose={() => {
            setWizardVideo(null)
            setContinueDraft(null)
          }}
          onCreated={(testId) => {
            // Don't close the wizard — let it stay visible with "Ativando..."
            // loading state until router.push completes the navigation.
            router.push(`/cms/youtube/ab-lab/${testId}`)
          }}
          onAbrirExistente={(id, status) => {
            // Rascunho que está na lista local abre no lugar; o resto navega (o assistente não importa next/navigation)
            if (status === 'draft' && drafts.some(d => d.id === id)) handleContinueDraft(id)
            else router.push(status === 'draft' ? `/cms/youtube/ab-lab/new?draft=${id}` : `/cms/youtube/ab-lab/${id}`)
          }}
          iniciarTeste={iniciarTeste}
          avisoDeVolume={avisoDeVolume}
          existingDraftId={continueDraft?.id}
          prefill={continueDraft ? { testType: continueDraft.type, draftVariants: continueDraft.variants } : undefined}
        />
      )}
    </div>
    </ContextoAssistente.Provider>
  )
}
