'use client'

import { useState, useReducer, useEffect, useCallback, useRef } from 'react'
import { Play, X, ArrowRight } from 'lucide-react'
import { StepTipo } from './step-tipo'
import { StepVariantes } from './step-variantes'
import type { VariantData } from './step-variantes'
import { PASSOS, ROTULO_DO_PASSO, ehPasso, indiceDoPasso, proximoPasso, passoAnterior, type Passo } from './wizard-passos'
import { StepRevisar } from './step-revisar'
import { faltaThumbDe } from './previa-por-tipo'
import { guardarTesteAbrindo } from './abrindo-teste'
import { LibraryPickerDialog } from './library-picker-dialog'
import { ICONE_BUSY } from './etd-icone-busy'
import { ICONE_ERRO } from './etd-icone-erro'
import { ICONE_AVISO } from './etd-icone-aviso'
import './ab-end-test-dialog.css'
import { duracaoDoVideo, dataDePublicacao } from '@/lib/youtube/ab-linha-video'
import { initWizardConfig, wizardConfigToAbConfig } from '@/lib/youtube/ab-wizard-adapter'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import {
  createAbTest,
  uploadVariant,
  createTextVariant,
  updateAbTestType,
  updateTextVariant,
  cleanupDraftVariants,
  fetchAbBriefingData,
  fetchLibraryEntries,
  lerDimensoesDaOriginal,
  type ResultadoCriarTeste,
} from '../actions'
import { useAvisoVolume, type LerAvisoDeVolume } from './use-aviso-volume'
import { useAvisoOriginal } from './use-aviso-original'
import { MAX_CHALLENGERS } from '@/lib/youtube/ab-wizard-reducer'
import { TestTypeSchema } from '@/lib/youtube/ab-schemas'
import { buildAbBriefingPrompt } from '@/lib/youtube/prompt-builders-ab'
import type { TestType, DisplayLabel, AbTestSiteSettings, AbTestStatus, ReferenciaDoTeste } from '@/lib/youtube/ab-types'
import { YtPortal } from '../../_components/yt-portal'
import type { CodigoRecusaNativa } from '@/lib/youtube/teste-youtube/nativo/aplicar-guarda'
import { FRASES } from '@/lib/youtube/teste-youtube/nativo/frases'

/** `startAbTest` chega por prop (a página, no servidor, o passa): nenhum client importa a action direto. */
/** `codigo` (e `ate`, ISO, quando o servidor sabe) dizem a recusa da guarda; o cliente nunca compara o texto de `error`. */
export type ResultadoIniciar = { ok: boolean; error?: string; codigo?: CodigoRecusaNativa; ate?: string }
export type IniciarTeste = (testId: string) => Promise<ResultadoIniciar>
export type { LerAvisoDeVolume }

/* ------------------------------------------------------------------ */
/*  Wizard video — same shape the dashboard already uses              */
/* ------------------------------------------------------------------ */

export interface WizardVideo {
  id: string
  title: string
  thumbnailUrl: string | null
  sourcePipelineId?: string | null
  /** Dados reais do vídeo para a prévia; ausentes (rascunho do banco) a prévia omite. */
  durationSeconds?: number
  publishedAt?: string | null
  channelHandle?: string | null
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface DraftVariant {
  id?: string
  label: string
  isOriginal: boolean
  thumbUrl: string | null
  titleText: string
}

interface PrefillData {
  testType?: TestType
  fromOptimizationCycle?: string
  draftVariants?: DraftVariant[]
}

interface Props {
  video: WizardVideo
  siteId: string
  settings: AbTestSiteSettings
  onClose: () => void
  onCreated: (testId: string) => void
  /** Abre o rascunho ou o teste que já existe para o vídeo; quem navega é o hospedeiro (o assistente não importa `next/navigation`). */
  onAbrirExistente: (id: string, status: AbTestStatus) => void
  iniciarTeste: IniciarTeste
  /** S8-F4 T11c: `avisoDeVolumeDoTeste` vem da página (servidor); ausente = sem aviso. */
  avisoDeVolume?: LerAvisoDeVolume
  prefill?: PrefillData
  existingDraftId?: string
  /** Referência (ex.: de concorrente) mostrada junto do passo das variantes */
  referencia?: React.ReactNode
  /** Ids do vídeo do concorrente, gravados em config.referencia ao criar o teste */
  referenciaDados?: ReferenciaDoTeste
}

/* ------------------------------------------------------------------ */
/*  State + Reducer                                                    */
/* ------------------------------------------------------------------ */

interface WizardState {
  step: Passo
  type: TestType | null
  variants: VariantData[]
  config: WizardConfig
  videoId: string
  videoTitle: string
  originalThumbUrl: string | null
  draftTestId: string | null
}

type WizardAction =
  | { type: 'SET_STEP'; step: Passo }
  | { type: 'SET_TYPE'; testType: TestType }
  | { type: 'SET_VARIANTS'; variants: VariantData[] }
  | { type: 'UPDATE_VARIANT'; index: number; data: Partial<VariantData> }
  | { type: 'ADD_VARIANT' }
  | { type: 'REMOVE_VARIANT'; index: number }
  | { type: 'SET_DRAFT_ID'; id: string }
  | { type: 'RESTAURAR_TIPO'; testType: TestType | null; variants: VariantData[] }

/** Cada espera mora no botão da ação (D-M6-4). */
type AcaoDoAssistente = 'criar' | 'trocar' | 'salvar' | 'ativar'

/** Mensagem do corpo do assistente (textos 2, 3, 4, 10, 19, 20 do plano). Nunca carrega o texto cru do servidor, salvo as recusas conhecidas. */
type AvisoDoAssistente =
  | { tipo: 'criar_falhou' }
  | { tipo: 'trocar_falhou'; pedido: TestType }
  | { tipo: 'servidor'; texto: string }
  | { tipo: 'ja_existe'; id: string; status: AbTestStatus }
  | { tipo: 'antes_de_ativar'; origem: 'ativar' | 'salvar' }
  | { tipo: 'ativar_falhou' }
  | { tipo: 'biblioteca'; texto: string }

/** Recusa conhecida do servidor ao criar: o código decide a tela, não o texto. Sem código conhecido devolve `padrao`. */
function avisoDaRecusaDeCriar<T extends AvisoDoAssistente | null>(r: ResultadoCriarTeste, padrao: T): AvisoDoAssistente | T {
  if (r.codigo === 'ja_existe' && r.existente) return { tipo: 'ja_existe', id: r.existente.id, status: r.existente.status }
  if (r.codigo) return { tipo: 'servidor', texto: r.error ?? '' }
  return padrao
}

/** Todas as versões desafiantes já estão no banco, sem arquivo novo nem texto editado: só falta iniciar (Y2, derivado do estado). */
function versoesGravadas(state: { type: TestType | null; variants: VariantData[] }): boolean {
  const desafiantes = state.variants.filter(v => !v.isOriginal)
  return desafiantes.length > 0 && desafiantes.every(v =>
    Boolean(v.gravada)
    && !v.thumbFile && (v.imagemGravada || !v.thumbUrl?.startsWith('data:')) && v.origem !== 'biblioteca'
    && (state.type === 'thumbnail' || v.titleText.trim() === (v.textoGravado ?? '')),
  )
}

const TIPOS_DA_BIBLIOTECA = ['image/jpeg', 'image/png']
const LIMITE_DA_BIBLIOTECA_BYTES = 2 * 1024 * 1024
const FRASE_BIBLIOTECA_INVALIDA = 'Esta imagem da Biblioteca não pode ser usada (precisa ser JPEG ou PNG, até 2 MB). Escolha outra.'

const NEXT_LABELS: DisplayLabel[] = ['B', 'C', 'D']

/** Chave do rascunho local v2 (D-M6-3): passos por nome, sem `hypothesis` nem `config`. */
function draftStorageKey(videoId: string): string {
  return `ab-wizard-draft-v2-${videoId}`
}

/** Chave do rascunho local dos 5 passos; só lida uma vez, para migrar. */
function chaveAntiga(videoId: string): string {
  return `ab-wizard-draft-${videoId}`
}

const VALIDADE_DO_RASCUNHO_MS = 7 * 24 * 60 * 60 * 1000

interface PersistedDraft {
  step: Passo
  type: TestType | null
  variants: Array<Omit<VariantData, 'thumbFile'> & { thumbFile?: null }>
  draftTestId: string | null
  savedAt: number
}

function saveDraft(videoId: string, state: WizardState): void {
  try {
    const draft: PersistedDraft = {
      step: state.step,
      type: state.type,
      variants: state.variants.map(v => ({
        ...v,
        thumbFile: null,
        thumbUrl: v.thumbDataUrl ?? (v.thumbUrl?.startsWith('blob:') ? null : v.thumbUrl),
      })),
      draftTestId: state.draftTestId,
      savedAt: Date.now(),
    }
    localStorage.setItem(draftStorageKey(videoId), JSON.stringify(draft))
  } catch { /* quota exceeded — ignore */ }
}

function ehObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function variantesDoRascunho(x: unknown): PersistedDraft['variants'] | null {
  if (!Array.isArray(x)) return null
  return x.every(ehObjeto) ? (x as PersistedDraft['variants']) : null
}

/** Passo antigo (0=tipo, 1=ideias, 2=variantes, 3=config, 4=revisar) → passo novo; 3 e 4 voltam a Variantes para revalidar. */
function passoDoRascunhoAntigo(n: unknown): Passo | null {
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > 4) return null
  return n === 0 ? 'tipo' : 'variantes'
}

/** Lê o rascunho local uma única vez. A v2 vence; sem ela, migra a chave antiga (descarta `hypothesis` e `config`). */
function loadDraft(videoId: string): PersistedDraft | null {
  const agora = Date.now()
  try {
    const raw = localStorage.getItem(draftStorageKey(videoId))
    if (raw !== null) {
      const d: unknown = JSON.parse(raw)
      const variants = ehObjeto(d) ? variantesDoRascunho(d.variants) : null
      if (!ehObjeto(d) || !ehPasso(d.step) || !variants || typeof d.savedAt !== 'number' || agora - d.savedAt > VALIDADE_DO_RASCUNHO_MS) {
        localStorage.removeItem(draftStorageKey(videoId))
        return null
      }
      return {
        step: d.step,
        type: (d.type as TestType | null) ?? null,
        variants,
        draftTestId: typeof d.draftTestId === 'string' ? d.draftTestId : null,
        savedAt: d.savedAt,
      }
    }
  } catch { return null }
  try {
    const rawAntigo = localStorage.getItem(chaveAntiga(videoId))
    if (rawAntigo === null) return null
    const d: unknown = JSON.parse(rawAntigo)
    const passo = ehObjeto(d) ? passoDoRascunhoAntigo(d.step) : null
    const variants = ehObjeto(d) ? variantesDoRascunho(d.variants) : null
    if (!ehObjeto(d) || !passo || !variants || typeof d.savedAt !== 'number' || agora - d.savedAt > VALIDADE_DO_RASCUNHO_MS) return null
    return { step: passo, type: (d.type as TestType | null) ?? null, variants, draftTestId: null, savedAt: d.savedAt }
  } catch { return null }
}

function clearDraft(videoId: string): void {
  try { localStorage.removeItem(draftStorageKey(videoId)); localStorage.removeItem(chaveAntiga(videoId)) } catch { /* ignore */ }
}

/** Tipo restaurado de rascunho (localStorage ou banco): só vale se for um dos três atuais; o antigo ('description') vira null. */
function tipoValido(t: unknown): TestType | null {
  const r = TestTypeSchema.safeParse(t)
  return r.success ? r.data : null
}

function makeOriginalVariant(videoTitle: string, thumbUrl?: string | null): VariantData {
  return { label: 'A', isOriginal: true, thumbUrl: thumbUrl ?? null, titleText: videoTitle }
}

function makeEmptyVariant(label: DisplayLabel): VariantData {
  return { label, isOriginal: false, thumbUrl: null, titleText: '' }
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.step }

    case 'SET_TYPE':
      return {
        ...state,
        type: action.testType,
        // Reset variants to original + one blank challenger
        variants: [
          makeOriginalVariant(state.videoTitle, state.originalThumbUrl),
          makeEmptyVariant('B'),
        ],
      }

    case 'SET_VARIANTS':
      return { ...state, variants: action.variants }

    case 'UPDATE_VARIANT': {
      const variants = [...state.variants]
      const proxima = { ...variants[action.index]!, ...action.data }
      // Trocar a imagem por outra (arquivo ou data URL) encerra a origem 'biblioteca'.
      if (!('origem' in action.data) && ('thumbUrl' in action.data || 'thumbFile' in action.data)) delete proxima.origem
      // Imagem nova de verdade (não o carimbo de "já subiu") volta a valer um upload
      if (!('imagemGravada' in action.data) && ('thumbUrl' in action.data || 'thumbFile' in action.data)) delete proxima.imagemGravada
      variants[action.index] = proxima
      return { ...state, variants }
    }

    case 'ADD_VARIANT': {
      const challengerCount = state.variants.filter(v => !v.isOriginal).length
      if (challengerCount >= MAX_CHALLENGERS) return state
      const nextLabel = NEXT_LABELS[challengerCount] ?? 'D'
      return {
        ...state,
        variants: [...state.variants, makeEmptyVariant(nextLabel)],
      }
    }

    case 'REMOVE_VARIANT': {
      const remaining = state.variants.filter((_, i) => i !== action.index)
      let labelIdx = 0
      const relabeled = remaining.map(v => {
        if (v.isOriginal) return v
        const label = NEXT_LABELS[labelIdx++] ?? ('D' as DisplayLabel)
        if (label === v.label) return v
        // A linha gravada tem o rótulo antigo: vira variante nova (D-M6-16). Imagem que só existe no
        // servidor (https) é baixada e enviada de novo no Ativar, como a da Biblioteca.
        const resto = { ...v }
        delete resto.gravada
        delete resto.textoGravado
        const soNoServidor = !resto.thumbFile && !resto.thumbDataUrl && /^https?:/.test(resto.thumbUrl ?? '')
        return { ...resto, label, ...(soNoServidor ? { origem: 'biblioteca' as const } : {}) }
      })
      return { ...state, variants: relabeled }
    }

    case 'SET_DRAFT_ID':
      return { ...state, draftTestId: action.id }

    // A troca de tipo falhou no servidor: volta ao tipo e às variantes de antes (Yannis I2)
    case 'RESTAURAR_TIPO':
      return { ...state, type: action.testType, variants: action.variants }

    default:
      return state
  }
}

/* ------------------------------------------------------------------ */
/*  Step rail config                                                   */
/* ------------------------------------------------------------------ */

function stepIsValid(step: Passo, state: WizardState): boolean {
  switch (step) {
    case 'tipo': return state.type !== null
    case 'variantes': {
      // Exige o que o tipo muda: título, imagem, ou os dois no combo (D-M6-11).
      const tipo = state.type
      return state.variants.some(v =>
        !v.isOriginal
        && (tipo === 'thumbnail' || Boolean(v.titleText.trim()))
        && (tipo === 'title' || Boolean(v.thumbUrl)),
      )
    }
    case 'revisar': return true
    default: return false
  }
}

/* ------------------------------------------------------------------ */
/*  AbCreateWizard                                                     */
/* ------------------------------------------------------------------ */

/** Estado inicial, calculado uma vez por montagem (lê o `localStorage` uma vez, não a cada render). */
function estadoInicial({ video, settings, prefill, existingDraftId }: Pick<Props, 'video' | 'settings' | 'prefill' | 'existingDraftId'>): WizardState {
  // Rascunho com variantes já gravadas (qualquer desafiante) reabre no Revisar, com o que está no banco (D-M6-16)
  const continuingDraft = Boolean(existingDraftId && prefill?.draftVariants?.some(v => !v.isOriginal))

  // Ao continuar um rascunho do banco, o rascunho local velho é ignorado
  if (continuingDraft) clearDraft(video.id)
  const draftLocal = continuingDraft ? null : loadDraft(video.id)

  const prefillType = tipoValido(prefill?.testType)
  // Com tipo pedido pelo prefill, o rascunho local só vale se for do mesmo tipo; senão é ignorado
  const saved = prefill?.testType && draftLocal?.type !== prefill.testType ? null : draftLocal
  const savedType = tipoValido(saved?.type)
  // Rascunho com tipo antigo volta ao passo "tipo" (nunca segue com tipo nulo ou inválido)
  const tipoInvalido = Boolean((prefill?.testType && !prefillType) || (saved?.type && !savedType))

  const defaultVariants = prefillType
    ? [makeOriginalVariant(video.title, video.thumbnailUrl), makeEmptyVariant('B')]
    : [makeOriginalVariant(video.title, video.thumbnailUrl)]

  // A original no banco tem rótulo `original` e título nulo; o assistente a mostra como "A" com o título real do vídeo.
  const dbVariants = prefill?.draftVariants?.map(v => ({
    label: (v.isOriginal ? 'A' : v.label) as DisplayLabel,
    isOriginal: v.isOriginal,
    thumbUrl: v.thumbUrl ?? (v.isOriginal ? video.thumbnailUrl : null),
    thumbFile: null as File | null,
    thumbDataUrl: null as string | null,
    titleText: v.isOriginal ? video.title : v.titleText,
    ...(v.id && !v.isOriginal ? { gravada: v.id, textoGravado: v.titleText } : {}),
  })) as VariantData[] | undefined

  const restoredVariants = saved?.variants?.map(v => ({
    ...v,
    thumbUrl: v.thumbUrl ?? v.thumbDataUrl ?? (v.isOriginal ? video.thumbnailUrl : null),
    thumbFile: null,
  })) as VariantData[] | undefined

  const type = prefillType ?? savedType
  const passoPedido: Passo = continuingDraft && !tipoInvalido ? 'revisar' : tipoInvalido ? 'tipo' : existingDraftId ? 'variantes' : (saved?.step ?? (prefillType ? 'variantes' : 'tipo'))
  return {
    // Sem tipo não há o que mostrar depois do passo Tipo
    step: type === null ? 'tipo' : passoPedido,
    type,
    variants: continuingDraft ? (dbVariants ?? defaultVariants) : (restoredVariants ?? (dbVariants?.some(v => !v.isOriginal) ? dbVariants : undefined) ?? defaultVariants),
    config: initWizardConfig(settings),
    videoId: video.id,
    videoTitle: video.title,
    originalThumbUrl: video.thumbnailUrl,
    draftTestId: existingDraftId ?? saved?.draftTestId ?? null,
  }
}

export function AbCreateWizard({ video, siteId, settings, onClose, onCreated, onAbrirExistente, iniciarTeste, avisoDeVolume, prefill, existingDraftId, referencia, referenciaDados }: Props) {
  const [state, rawDispatch] = useReducer(wizardReducer, { video, settings, prefill, existingDraftId }, estadoInicial)

  // A chave dos 5 passos só é lida na montagem (para migrar); depois sai do armazenamento.
  useEffect(() => {
    try { localStorage.removeItem(chaveAntiga(video.id)) } catch { /* ignore */ }
  }, [video.id])

  const draftCleared = useRef(false)
  const dispatch = useCallback((action: WizardAction) => { rawDispatch(action) }, [])

  useEffect(() => {
    if (!draftCleared.current) saveDraft(video.id, state)
  }, [video.id, state])

  // Cada espera mora no seu botão (D-M6-4): `acao` é a fonte única de "ocupado". O ref fecha a janela entre o clique e a renderização.
  const [acao, setAcao] = useState<AcaoDoAssistente | null>(null)
  const acaoRef = useRef<AcaoDoAssistente | null>(null)
  const mudarAcao = (a: AcaoDoAssistente | null) => { acaoRef.current = a; setAcao(a) }
  const ocupado = acao !== null
  // Fechar trava só enquanto salva ou ativa; criar/trocar fecham normalmente (o `ja_existe` recupera o rascunho).
  const fechaBloqueado = acao === 'salvar' || acao === 'ativar'
  const [aviso, setAviso] = useState<AvisoDoAssistente | null>(null)

  const dialogRef = useRef<HTMLDivElement | null>(null)
  // A leitura da original só começa depois que o diálogo (portal) está no DOM: ver use-aviso-original.ts
  const [dialogoMontado, setDialogoMontado] = useState(false)
  // Recusa da guarda do teste do YouTube ao iniciar (D-7): frases fechadas; só a falha de conferência oferece "Tentar de novo".
  const [recusa, setRecusa] = useState<{ codigo: CodigoRecusaNativa; ate: string | null } | null>(null)
  const refDialogo = useCallback((el: HTMLDivElement | null) => { dialogRef.current = el; setDialogoMontado(el !== null) }, [])
  const [libraryPickerFor, setLibraryPickerFor] = useState<number | null>(null)
  const [libraryEntries, setLibraryEntries] = useState<Awaited<ReturnType<typeof fetchLibraryEntries>> | null>(null)

  const abrirBiblioteca = async (variantIndex: number) => {
    if (!libraryEntries) {
      const entries = await fetchLibraryEntries()
      setLibraryEntries(entries)
    }
    setLibraryPickerFor(variantIndex)
  }
  const escolherDaBiblioteca = (label: DisplayLabel) => {
    const i = state.variants.findIndex(v => v.label === label)
    if (i >= 0) void abrirBiblioteca(i)
  }
  // D12: aviso de original baixa; só leitura, não valida passo nem envia
  const avisoOriginal = useAvisoOriginal(lerDimensoesDaOriginal, state.draftTestId, state.type ?? '', dialogoMontado && state.step !== 'tipo')

  const faltaThumb = state.type ? faltaThumbDe(state.type, state.variants) : null
  const avisoVolume = useAvisoVolume(avisoDeVolume, state.draftTestId, dialogoMontado && state.step === 'revisar', state.variants.length)

  // --- Escape key ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !fechaBloqueado) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, fechaBloqueado])

  // --- Focus trap ---
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    function trap(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    el.addEventListener('keydown', trap)
    first?.focus()
    return () => el.removeEventListener('keydown', trap)
  }, [state.step])

  // --- Type selection handler (creates draft) ---
  const handleTypeSelect = async (testType: TestType) => {
    if (acaoRef.current !== null) return
    // Clicar no tipo que já está escolhido não é troca: segue, sem apagar o que já está gravado (Yannis I3)
    if (testType === state.type && state.draftTestId) {
      setRecusa(null)
      setAviso(null)
      dispatch({ type: 'SET_STEP', step: 'variantes' })
      return
    }
    setRecusa(null)
    setAviso(null)
    const anterior = { type: state.type, variants: state.variants }
    dispatch({ type: 'SET_TYPE', testType })
    const trocando = Boolean(state.draftTestId)
    mudarAcao(trocando ? 'trocar' : 'criar')
    try {
      if (state.draftTestId) {
        const res = await updateAbTestType(state.draftTestId, testType)
        if (!res.ok) {
          console.warn(res.error)
          dispatch({ type: 'RESTAURAR_TIPO', testType: anterior.type, variants: anterior.variants })
          setAviso({ tipo: 'trocar_falhou', pedido: testType })
          return
        }
        dispatch({ type: 'SET_STEP', step: 'variantes' })
        return
      }

      const result = await createAbTest({
        site_id: siteId,
        youtube_video_id: video.id,
        name: video.title,
        test_type: testType,
        config: wizardConfigToAbConfig(state.config),
        ...(referenciaDados ? { referencia: referenciaDados } : {}),
      })

      if (result.ok && result.id) {
        dispatch({ type: 'SET_DRAFT_ID', id: result.id })
        dispatch({ type: 'SET_STEP', step: 'variantes' })
      } else {
        setAviso(avisoDaRecusaDeCriar(result, { tipo: 'criar_falhou' }))
      }
    } catch (e) {
      console.warn(e)
      if (trocando) {
        dispatch({ type: 'RESTAURAR_TIPO', testType: anterior.type, variants: anterior.variants })
        setAviso({ tipo: 'trocar_falhou', pedido: testType })
      } else {
        setAviso({ tipo: 'criar_falhou' })
      }
    } finally {
      mudarAcao(null)
    }
  }

  // --- Cowork briefing handler ---
  const handleCoworkClick = useCallback(async () => {
    if (!state.type) throw new Error('Selecione o tipo de teste antes de usar o Cowork')
    const result = await fetchAbBriefingData(video.id, state.draftTestId ?? '')
    if (!result.ok) throw new Error(result.error)
    const prompt = buildAbBriefingPrompt({
      testType: state.type,
      data: result.data,
    })
    await navigator.clipboard.writeText(prompt)
  }, [video.id, state.type, state.draftTestId])

  // Recusa do servidor ao iniciar: as duas frases do mockup (D-7) no lugar do texto cru; outro erro vira o texto 10.
  const falhouAoIniciar = (res: ResultadoIniciar) => {
    if (res.codigo === 'teste_youtube' || res.codigo === 'guarda_falhou') {
      setRecusa({ codigo: res.codigo, ate: res.codigo === 'teste_youtube' && res.ate ? res.ate : null })
      setAviso(null)
      return
    }
    console.warn(res.error)
    setRecusa(null)
    setAviso({ tipo: 'ativar_falhou' })
  }

  // Edição ou troca de passo invalida a recusa: as versões só são gravadas em `handleSubmit`, então "Tentar de novo" com versões editadas iniciaria as velhas.
  const editar = (acaoDoReducer: WizardAction) => { setRecusa(null); setAviso(null); dispatch(acaoDoReducer) }

  // --- Launch / save handler ---
  const handleSubmit = async (isLaunch: boolean) => {
    if (acaoRef.current !== null) return
    setRecusa(null)
    setAviso(null)
    mudarAcao(isLaunch ? 'ativar' : 'salvar')
    // Onde a exceção aconteceu decide o texto: antes de ativar (20), no início (10) ou depois, já navegando (nenhum).
    let etapa: 'antes' | 'iniciar' | 'depois' = 'antes'
    let navegando = false
    // Falha de gravação das versões: nada foi ativado (texto 20); o motivo do servidor vai só para o diagnóstico.
    const falhaAntes = (motivo?: unknown) => {
      console.warn(motivo)
      setAviso({ tipo: 'antes_de_ativar', origem: isLaunch ? 'ativar' : 'salvar' })
    }
    try {
      let testId = state.draftTestId

      // 1. Create test if no draft exists
      if (!testId) {
        const result = await createAbTest({
          site_id: siteId,
          youtube_video_id: video.id,
          name: video.title,
          test_type: state.type!,
          config: wizardConfigToAbConfig(state.config),
          ...(referenciaDados ? { referencia: referenciaDados } : {}),
        })
        if (!result.ok || !result.id) {
          const recusaDoServidor = avisoDaRecusaDeCriar(result, null)
          if (recusaDoServidor) setAviso(recusaDoServidor)
          else falhaAntes(result.error)
          return
        }
        testId = result.id
      }

      dispatch({ type: 'SET_DRAFT_ID', id: testId })

      // Marca no estado o que acabou de ser gravado (um Ativar repetido não duplica; D-M6-16).
      const marcarGravada = (label: DisplayLabel, id: string, texto: string, extra: Partial<VariantData> = {}) => {
        const index = state.variants.findIndex(x => x.label === label)
        if (index >= 0) dispatch({ type: 'UPDATE_VARIANT', index, data: { gravada: id, textoGravado: texto, ...extra } })
      }
      const desafiantes = state.variants.filter(v => !v.isOriginal)

      // 2. Upload image variants (thumbnail/combo)
      if (state.type === 'thumbnail' || state.type === 'combo') {
        const variantsWithNewData = desafiantes.filter(v =>
          v.thumbFile || (v.thumbUrl?.startsWith('data:') && !v.imagemGravada) || v.origem === 'biblioteca',
        )
        // Gravadas que continuam no estado sem arquivo novo ficam como estão
        const gravadasMantidas = desafiantes.filter(v => v.gravada && !variantsWithNewData.includes(v))

        if (variantsWithNewData.length > 0 || gravadasMantidas.length > 0) {
          // Imagem da Biblioteca: baixa ANTES de qualquer limpeza do rascunho (N2), para uma falha aqui não apagar nada.
          const daBiblioteca = new Map<string, Blob>()
          for (const v of variantsWithNewData) {
            if (v.origem !== 'biblioteca' || v.thumbFile || !v.thumbUrl) continue
            let blob: Blob
            try {
              const resp = await fetch(v.thumbUrl)
              if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
              blob = await resp.blob()
            } catch (e) {
              falhaAntes(e)
              return
            }
            if (!TIPOS_DA_BIBLIOTECA.includes(blob.type) || blob.size > LIMITE_DA_BIBLIOTECA_BYTES) {
              setAviso({ tipo: 'biblioteca', texto: FRASE_BIBLIOTECA_INVALIDA })
              return
            }
            daBiblioteca.set(v.label, blob)
          }
          // O arquivo baixado passa a viver na memória: se o upload falhar depois da limpeza, a nova tentativa não depende da URL apagada (Phil M1)
          for (const [label, blob] of daBiblioteca) {
            const index = state.variants.findIndex(x => x.label === label)
            if (index >= 0) dispatch({ type: 'UPDATE_VARIANT', index, data: { thumbFile: new File([blob], `variant-${label}.jpg`, { type: blob.type }) } })
          }

          const cleanupRes = await cleanupDraftVariants(testId, { manter: gravadasMantidas.map(v => v.label) })
          if (!cleanupRes.ok) {
            falhaAntes(cleanupRes.error ?? 'Failed to clean up draft')
            return
          }

          for (const v of variantsWithNewData) {
            let file: File | Blob | null = v.thumbFile ?? daBiblioteca.get(v.label) ?? null
            if (!file && v.thumbUrl?.startsWith('data:')) {
              const [header, b64] = v.thumbUrl.split(',')
              const mime = header?.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
              const bytes = atob(b64 ?? '')
              const arr = new Uint8Array(bytes.length)
              for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
              file = new Blob([arr], { type: mime })
            }
            if (!file) continue
            const fd = new FormData()
            fd.append('file', file, `variant-${v.label}.jpg`)
            fd.append('label', v.label)
            if (v.titleText?.trim()) fd.append('title_text', v.titleText.trim())
            const uploadResult = await uploadVariant(testId, fd)
            if (!uploadResult.ok) {
              falhaAntes(uploadResult.error ?? 'Failed to upload variant')
              return
            }
            if (uploadResult.variantId) {
              // O arquivo já subiu: não sobe de novo num "Tentar de novo" (a Biblioteca deixa de ser origem; o `data:` fica de prévia)
              marcarGravada(v.label, uploadResult.variantId, v.titleText.trim(), { thumbFile: null, thumbDataUrl: null, imagemGravada: true })
            }
          }

          // Combo reaberto: título editado de uma imagem já gravada
          if (state.type === 'combo') {
            for (const v of gravadasMantidas) {
              if (v.titleText.trim() === (v.textoGravado ?? '')) continue
              const upd = await updateTextVariant(v.gravada!, { title_text: v.titleText.trim() })
              if (!upd.ok) {
                falhaAntes(upd.error ?? 'Failed to update variant')
                return
              }
              marcarGravada(v.label, v.gravada!, v.titleText.trim())
            }
          }
        }
      }

      // 3. Text-only variants (title — NOT combo, which was handled in step 2)
      if (state.type === 'title') {
        const comTexto = desafiantes
          .filter(v => !v.isCoworkGenerated)
          .filter(v => v.titleText.trim().length > 0)

        // Só os rótulos que saíram do estado são apagados; o resto já está gravado
        const cleanupRes = await cleanupDraftVariants(testId, { manter: comTexto.filter(v => v.gravada).map(v => v.label) })
        if (!cleanupRes.ok) {
          falhaAntes(cleanupRes.error ?? 'Failed to clean up draft')
          return
        }

        for (const tv of comTexto) {
          const texto = tv.titleText.trim()
          if (tv.gravada) {
            if (texto === (tv.textoGravado ?? '')) continue
            const upd = await updateTextVariant(tv.gravada, { title_text: texto })
            if (!upd.ok) {
              falhaAntes(upd.error ?? 'Failed to update text variant')
              return
            }
            marcarGravada(tv.label, tv.gravada, texto)
            continue
          }
          const textResult = await createTextVariant({
            test_id: testId,
            title_text: texto || undefined,
            label: tv.label,
          })
          if (!textResult.ok) {
            falhaAntes(textResult.error ?? 'Failed to create text variant')
            return
          }
          if (textResult.id) marcarGravada(tv.label, textResult.id, texto)
        }
      }

      // 4. Optionally launch
      if (isLaunch) {
        etapa = 'iniciar'
        const startResult = await iniciarTeste(testId)
        if (!startResult.ok) {
          falhouAoIniciar(startResult)
          return
        }
      }

      draftCleared.current = true
      clearDraft(video.id)
      if (isLaunch) {
        // `acao` fica em 'ativar' até a navegação terminar (não pisca de volta para o painel). Se `onCreated` lançar, o `finally` limpa.
        etapa = 'depois'
        guardarTesteAbrindo({ id: testId, titulo: video.title, miniaturaUrl: state.originalThumbUrl ?? video.thumbnailUrl ?? null })
        onCreated(testId)
        navegando = true
      } else {
        onClose()
      }
    } catch (e) {
      console.warn(e)
      if (etapa === 'antes') setAviso({ tipo: 'antes_de_ativar', origem: isLaunch ? 'ativar' : 'salvar' })
      else if (etapa === 'iniciar') setAviso({ tipo: 'ativar_falhou' })
    } finally {
      if (!navegando) mudarAcao(null)
    }
  }

  // "Tentar de novo": só o início (rascunho e versões já estão gravados; repetir o resto duplicaria versões de título).
  const tentarIniciarDeNovo = async () => {
    const testId = state.draftTestId
    if (!testId || acaoRef.current !== null) return
    setRecusa(null)
    setAviso(null)
    mudarAcao('ativar')
    let navegando = false
    try {
      const r = await iniciarTeste(testId)
      if (!r.ok) {
        falhouAoIniciar(r)
        return
      }
      draftCleared.current = true
      clearDraft(video.id)
      guardarTesteAbrindo({ id: testId, titulo: video.title, miniaturaUrl: state.originalThumbUrl ?? video.thumbnailUrl ?? null })
      onCreated(testId)
      navegando = true
    } catch (e) {
      console.warn(e)
      setAviso({ tipo: 'ativar_falhou' })
    } finally {
      if (!navegando) mudarAcao(null)
    }
  }

  // "Tentar de novo" do primário: com as versões já gravadas repete só o início; senão repete o Ativar inteiro (idempotente, D-M6-16).
  const tentarDeNovo = () => {
    if (versoesGravadas(state)) void tentarIniciarDeNovo()
    else void handleSubmit(true)
  }

  // --- Step navigation helpers ---
  const canAdvance = stepIsValid(state.step, state)
  const goBack = () => {
    if (acaoRef.current !== null) return
    editar({ type: 'SET_STEP', step: passoAnterior(state.step) })
  }
  const goNext = () => {
    if (acaoRef.current !== null) return
    editar({ type: 'SET_STEP', step: proximoPasso(state.step) })
  }

  // --- Render current step ---
  function renderStep() {
    switch (state.step) {
      case 'tipo':
        return (
          <StepTipo
            selected={state.type}
            onSelect={t => void handleTypeSelect(t)}
            pendente={acao === 'criar' || acao === 'trocar' ? state.type : null}
            travado={ocupado}
          />
        )
      case 'variantes':
        return (
          <>
          {referencia}
          <StepVariantes
            type={state.type!}
            variants={state.variants}
            originalThumbUrl={state.originalThumbUrl}
            onUpdateVariant={(i, d) => editar({ type: 'UPDATE_VARIANT', index: i, data: d })}
            onAddVariant={() => editar({ type: 'ADD_VARIANT' })}
            onRemoveVariant={i => editar({ type: 'REMOVE_VARIANT', index: i })}
            onPickFromLibrary={abrirBiblioteca}
            onPedirIdeias={handleCoworkClick}
          />
          </>
        )
      case 'revisar':
        return (
          <StepRevisar
            type={state.type!}
            variants={state.variants.map(v => ({
              label: v.label,
              thumbUrl: v.thumbUrl,
              title: v.titleText || 'Sem título',
              isOriginal: v.isOriginal,
            }))}
            config={state.config}
            meta={{
              canal: video.channelHandle?.replace(/^@/, '').trim() || null,
              publicadoEm: video.publishedAt && !Number.isNaN(Date.parse(video.publishedAt)) ? dataDePublicacao(video.publishedAt) : null,
              duracao: video.durationSeconds ? duracaoDoVideo(video.durationSeconds) : null,
            }}
            onEscolherDaBiblioteca={escolherDaBiblioteca}
            avisoOriginal={avisoOriginal}
            avisoVolume={avisoVolume}
            faltaThumb={faltaThumb}
            ocupado={acao === 'salvar' || acao === 'ativar'}
            comErro={aviso !== null}
          />
        )
      default:
        return null
    }
  }

  const jaExiste = aviso?.tipo === 'ja_existe' ? aviso : null
  const falhouAtivar = aviso?.tipo === 'ativar_falhou' || (aviso?.tipo === 'antes_de_ativar' && aviso.origem === 'ativar')
  const BTN = 'inline-flex items-center gap-[7px] justify-center min-h-[44px] py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em]'
  const BTN_SEC = `${BTN} text-cms-text disabled:text-cms-text-dim disabled:cursor-not-allowed`
  const BTN_PRI = `${BTN} w-full min-[480px]:w-auto bg-cms-accent disabled:opacity-40 disabled:cursor-not-allowed`
  const bordaSec = { border: '1px solid var(--cms-border, #332D25)' }
  const estiloPri = { border: '1px solid var(--cms-accent)', color: 'rgb(26,18,12)' }
  const spinner = <span className="etd-tok etd-spin pequeno inline-flex">{ICONE_BUSY}</span>

  return (
    <YtPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      style={{ backdropFilter: 'blur(6px)' }}
      onClick={fechaBloqueado ? undefined : onClose}
    >
      <div
        ref={refDialogo}
        role="dialog"
        aria-modal="true"
        aria-label="Novo Teste A/B"
        className="etd-tok flex flex-col mx-4 animate-ab-fade-up"
        style={{
          width: 'min(900px, 100%)',
          maxHeight: 'calc(100vh - 80px)',
          background: 'var(--cms-surface)',
          border: '1px solid var(--cms-border, #332D25)',
          borderRadius: 18,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-[16px] py-[20px] px-[24px] shrink-0" style={{ borderBottom: '1px solid var(--cms-border, #332D25)' }}>
          <div>
            <h2 className="text-[18px] font-bold text-cms-text m-0">Novo teste A/B</h2>
            <div className="text-[12.5px] text-cms-text-dim mt-[3px] max-w-[580px] whitespace-nowrap overflow-hidden text-ellipsis">{video.title}</div>
          </div>
          <button onClick={onClose} disabled={fechaBloqueado} className="inline-flex items-center justify-center w-11 h-11 -mt-[10px] -mr-[10px] text-cms-text-dim shrink-0 disabled:opacity-40" style={{ background: 'transparent', border: 'none' }} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Step rail */}
        <StepRail currentStep={state.step} travado={ocupado} onStepClick={s => { if (acaoRef.current === null) editar({ type: 'SET_STEP', step: s }) }} />

        {/* Body */}
        <div key={state.step} className="flex-1 overflow-y-auto p-[24px]" style={{ animation: 'fadeIn 150ms ease-out' }}>
          {renderStep()}
          {state.step === 'revisar' && acao === 'ativar' ? (
            <div className="etd-msg busy" role="status">{ICONE_BUSY}<div><strong>Ativando o teste no YouTube</strong>Pode levar alguns segundos. Se fechar, o teste continua e aparece na lista.</div></div>
          ) : null}
          {state.step === 'revisar' && acao === 'salvar' ? (
            <div className="etd-msg busy" role="status">{ICONE_BUSY}<div><strong>Salvando o rascunho</strong>Leva alguns segundos.</div></div>
          ) : null}
          <MensagemDoAssistente aviso={aviso} onTentarDeNovo={() => { const t = aviso?.tipo === 'trocar_falhou' ? aviso.pedido : state.type; if (t) void handleTypeSelect(t) }} />
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-x-[12px] gap-y-[10px] py-[16px] px-[16px] sm:px-[24px] shrink-0" style={{ borderTop: '1px solid var(--cms-border, #332D25)', background: 'var(--cms-bg-side)' }}>
          <span className="text-[12px] text-cms-text-muted">
            {recusa ? (
              <span className="text-red-400" role="alert">
                {recusa.codigo === 'teste_youtube'
                  ? (recusa.ate ? FRASES.guarda.motivoRecusa(new Date(recusa.ate)) : FRASES.guarda.motivoRecusaSemData)
                  : FRASES.guarda.guardaFalhou}
                {recusa.codigo === 'guarda_falhou' ? (
                  <button type="button" onClick={() => void tentarIniciarDeNovo()} disabled={ocupado} className="ml-[10px] underline font-semibold">
                    {FRASES.guarda.tentarDeNovo}
                  </button>
                ) : null}
              </span>
            ) : acao === 'criar' ? (
              <div className="etd-msg busy compact" role="status">{ICONE_BUSY}<div><strong>Criando o rascunho…</strong>Leva alguns segundos.</div></div>
            ) : acao === 'trocar' ? (
              <div className="etd-msg busy compact" role="status">{ICONE_BUSY}<div><strong>Trocando o tipo…</strong>Leva alguns segundos.</div></div>
            ) : (
              `Passo ${indiceDoPasso(state.step) + 1} de ${PASSOS.length}`
            )}
          </span>
          <div className="flex flex-col-reverse min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end gap-[10px] w-full min-[480px]:w-auto ml-auto">
            {jaExiste ? (
              <>
                <button onClick={onClose} className={BTN_SEC} style={bordaSec}>Cancelar</button>
                <button onClick={() => onAbrirExistente(jaExiste.id, jaExiste.status)} className={BTN_PRI} style={estiloPri}>
                  {jaExiste.status === 'draft' ? 'Abrir rascunho' : 'Abrir o teste'}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                {state.step === 'tipo' ? (
                  <button onClick={onClose} className={BTN_SEC} style={bordaSec}>
                    Cancelar
                  </button>
                ) : (
                  <button onClick={goBack} disabled={ocupado} className={BTN_SEC} style={bordaSec}>
                    Voltar
                  </button>
                )}
                {state.step !== 'revisar' && (
                  <button
                    onClick={goNext}
                    disabled={!canAdvance || ocupado}
                    className={BTN_PRI}
                    style={estiloPri}
                  >
                    Próximo
                    <ArrowRight size={16} aria-hidden="true" />
                  </button>
                )}
                {state.step === 'revisar' && (
                  <>
                    <button onClick={() => void handleSubmit(false)} disabled={ocupado} className={BTN_SEC} style={bordaSec}>
                      {acao === 'salvar' ? <>{spinner}Salvando…</> : 'Salvar rascunho'}
                    </button>
                    <button
                      onClick={() => (falhouAtivar ? tentarDeNovo() : void handleSubmit(true))}
                      disabled={ocupado || (faltaThumb !== null && !falhouAtivar)}
                      className={BTN_PRI}
                      style={estiloPri}
                    >
                      {acao === 'ativar' ? <>{spinner}Ativando…</> : falhouAtivar ? 'Tentar de novo' : <><Play size={14} aria-hidden="true" />Ativar teste</>}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {libraryPickerFor !== null && libraryEntries && (
        <LibraryPickerDialog
          entries={libraryEntries}
          onSelect={(blobUrl, liftAtWin) => {
            editar({
              type: 'UPDATE_VARIANT',
              index: libraryPickerFor,
              data: { thumbUrl: blobUrl, origem: 'biblioteca', briefing: liftAtWin ? `Da Biblioteca: +${liftAtWin}% lift` : undefined },
            })
            setLibraryPickerFor(null)
          }}
          onClose={() => setLibraryPickerFor(null)}
        />
      )}
    </div>
    </YtPortal>
  )
}

/* ------------------------------------------------------------------ */
/*  Mensagens do corpo (erros em português, sem texto cru do servidor)  */
/* ------------------------------------------------------------------ */

function MensagemDoAssistente({ aviso, onTentarDeNovo }: { aviso: AvisoDoAssistente | null; onTentarDeNovo: () => void }) {
  if (!aviso) return null
  const tentar = (
    <button type="button" onClick={onTentarDeNovo} className="mt-[6px] min-h-[44px] px-[4px] underline font-semibold text-[13px]" style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer' }}>
      Tentar de novo
    </button>
  )
  switch (aviso.tipo) {
    case 'criar_falhou':
      return <div className="etd-msg err" role="alert">{ICONE_ERRO}<div><strong>Não foi possível criar o rascunho</strong>Nada foi salvo. Tente de novo.<div>{tentar}</div></div></div>
    case 'trocar_falhou':
      return <div className="etd-msg err" role="alert">{ICONE_ERRO}<div><strong>Não foi possível trocar o tipo</strong>O rascunho continua como estava.<div>{tentar}</div></div></div>
    case 'servidor':
      return <div className="etd-msg err" role="alert">{ICONE_ERRO}<div>{aviso.texto}</div></div>
    case 'biblioteca':
      return <div className="etd-msg err" role="alert">{ICONE_ERRO}<div>{aviso.texto}</div></div>
    case 'ja_existe':
      return aviso.status === 'draft'
        ? <div className="etd-msg warn" role="status">{ICONE_AVISO}<div><strong>Já existe um rascunho deste vídeo</strong>Abra-o na lista de rascunhos para continuar de onde parou.</div></div>
        : <div className="etd-msg warn" role="status">{ICONE_AVISO}<div><strong>Este vídeo já tem um teste</strong>Termine ou cancele esse teste antes de criar outro.</div></div>
    case 'antes_de_ativar':
      return <div className="etd-msg err" role="alert">{ICONE_ERRO}<div><strong>Não foi possível salvar as variantes</strong>Suas variantes não foram salvas e nada foi ativado. Tente de novo.</div></div>
    case 'ativar_falhou':
      return <div className="etd-msg err" role="alert">{ICONE_ERRO}<div><strong>Não foi possível ativar</strong>O rascunho ficou salvo. Você pode tentar de novo.</div></div>
  }
}

/* ------------------------------------------------------------------ */
/*  Step rail (sub-component)                                          */
/* ------------------------------------------------------------------ */

function StepRail({ currentStep, travado, onStepClick }: { currentStep: Passo; travado: boolean; onStepClick: (step: Passo) => void }) {
  const atual = indiceDoPasso(currentStep)
  return (
    <div className="flex items-center py-[16px] px-[24px] shrink-0" style={{ borderBottom: '1px solid var(--cms-border, #332D25)' }}>
      {PASSOS.map((passo, visualIdx) => {
        const label = ROTULO_DO_PASSO[passo]
        const isCompleted = atual > visualIdx
        const isActive = atual === visualIdx
        const isFuture = atual < visualIdx
        const clicavel = !isFuture && !travado
        return (
          <div key={passo} className="contents">
            <div
              className="flex items-center gap-[9px]"
              style={{ cursor: clicavel ? 'pointer' : 'default' }}
              onClick={() => clicavel && onStepClick(passo)}
              {...(!isFuture ? { role: 'button' as const, tabIndex: 0, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStepClick(passo) } } } : {})}
            >
              <span
                className="flex items-center justify-center rounded-full font-mono text-[12px] font-bold shrink-0"
                style={{
                  width: 26, height: 26,
                  background: isActive ? 'var(--cms-accent)' : isCompleted ? 'var(--cms-green)' : 'var(--cms-surface-3, var(--cms-surface-hover))',
                  color: isActive || isCompleted ? 'rgb(21,18,13)' : 'var(--cms-text-muted)',
                }}
              >
                {isCompleted ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                ) : visualIdx + 1}
              </span>
              <span className={`text-[13px] ${isActive ? '' : 'hidden sm:inline'}`} style={{ fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--cms-text)' : 'var(--cms-text-dim)' }}>
                {label}
              </span>
            </div>
            {visualIdx < PASSOS.length - 1 && (
              <div className="flex-1 min-w-[8px] h-px mx-[6px] sm:mx-[12px]" style={{ background: 'var(--cms-border, #332D25)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
