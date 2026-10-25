'use client'

import { useState, useReducer, useEffect, useTransition, useCallback, useRef } from 'react'
import { Play, X, ArrowRight } from 'lucide-react'
import { StepTipo } from './step-tipo'
import { StepVariantes } from './step-variantes'
import type { VariantData } from './step-variantes'
import { PASSOS, ROTULO_DO_PASSO, ehPasso, indiceDoPasso, proximoPasso, passoAnterior, type Passo } from './wizard-passos'
import { StepRevisar } from './step-revisar'
import { LibraryPickerDialog } from './library-picker-dialog'
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
} from '../actions'
import { useAvisoVolume, type LerAvisoDeVolume } from './use-aviso-volume'
import { useAvisoOriginal } from './use-aviso-original'
import { MAX_CHALLENGERS } from '@/lib/youtube/ab-wizard-reducer'
import { TestTypeSchema } from '@/lib/youtube/ab-schemas'
import { buildAbBriefingPrompt } from '@/lib/youtube/prompt-builders-ab'
import type { TestType, DisplayLabel, AbTestSiteSettings, ReferenciaDoTeste } from '@/lib/youtube/ab-types'
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
  isLaunching: boolean
  error: string | null
}

type WizardAction =
  | { type: 'SET_STEP'; step: Passo }
  | { type: 'SET_TYPE'; testType: TestType }
  | { type: 'SET_VARIANTS'; variants: VariantData[] }
  | { type: 'UPDATE_VARIANT'; index: number; data: Partial<VariantData> }
  | { type: 'ADD_VARIANT' }
  | { type: 'REMOVE_VARIANT'; index: number }
  | { type: 'SET_DRAFT_ID'; id: string }
  | { type: 'SET_LAUNCHING'; isLaunching: boolean }
  | { type: 'SET_ERROR'; error: string | null }

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
      return { ...state, step: action.step, error: null }

    case 'SET_TYPE':
      return {
        ...state,
        type: action.testType,
        // Reset variants to original + one blank challenger
        variants: [
          makeOriginalVariant(state.videoTitle, state.originalThumbUrl),
          makeEmptyVariant('B'),
        ],
        error: null,
      }

    case 'SET_VARIANTS':
      return { ...state, variants: action.variants }

    case 'UPDATE_VARIANT': {
      const variants = [...state.variants]
      const proxima = { ...variants[action.index]!, ...action.data }
      // Trocar a imagem por outra (arquivo ou data URL) encerra a origem 'biblioteca'.
      if (!('origem' in action.data) && ('thumbUrl' in action.data || 'thumbFile' in action.data)) delete proxima.origem
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

    case 'SET_LAUNCHING':
      return { ...state, isLaunching: action.isLaunching }

    case 'SET_ERROR':
      return { ...state, error: action.error }

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

  const dbVariants = prefill?.draftVariants?.map(v => ({
    label: v.label as DisplayLabel,
    isOriginal: v.isOriginal,
    thumbUrl: v.thumbUrl ?? (v.isOriginal ? video.thumbnailUrl : null),
    thumbFile: null as File | null,
    thumbDataUrl: null as string | null,
    titleText: v.titleText,
    ...(v.id && !v.isOriginal ? { gravada: v.id, textoGravado: v.titleText } : {}),
  })) as VariantData[] | undefined

  const restoredVariants = saved?.variants?.map(v => ({
    ...v,
    thumbUrl: v.thumbUrl ?? v.thumbDataUrl ?? (v.isOriginal ? video.thumbnailUrl : null),
    thumbFile: null,
  })) as VariantData[] | undefined

  const type = prefillType ?? savedType
  const passoPedido: Passo = continuingDraft && !tipoInvalido ? 'revisar' : tipoInvalido ? 'tipo' : (saved?.step ?? (prefillType || existingDraftId ? 'variantes' : 'tipo'))
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
    isLaunching: false,
    error: null,
  }
}

export function AbCreateWizard({ video, siteId, settings, onClose, onCreated, iniciarTeste, avisoDeVolume, prefill, existingDraftId, referencia, referenciaDados }: Props) {
  const [state, rawDispatch] = useReducer(wizardReducer, { video, settings, prefill, existingDraftId }, estadoInicial)

  // A chave dos 5 passos só é lida na montagem (para migrar); depois sai do armazenamento.
  useEffect(() => {
    try { localStorage.removeItem(chaveAntiga(video.id)) } catch { /* ignore */ }
  }, [video.id])

  const draftCleared = useRef(false)
  const dispatch = useCallback((action: WizardAction) => { rawDispatch(action) }, [])

  useEffect(() => {
    if (!state.isLaunching && !draftCleared.current) saveDraft(video.id, state)
  }, [video.id, state])

  const [isPending, startTransition] = useTransition()
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
  const avisoOriginal = useAvisoOriginal(lerDimensoesDaOriginal, state.draftTestId, state.type ?? '', dialogoMontado && state.step !== 'tipo' && !state.isLaunching)

  const avisoVolume = useAvisoVolume(avisoDeVolume, state.draftTestId, dialogoMontado && state.step === 'revisar' && !state.isLaunching, state.variants.length)

  // --- Escape key ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape' && !state.isLaunching) onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, state.isLaunching])

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
  const handleTypeSelect = useCallback((testType: TestType) => {
    dispatch({ type: 'SET_TYPE', testType })
    startTransition(async () => {
      if (state.draftTestId) {
        const res = await updateAbTestType(state.draftTestId, testType)
        if (!res.ok) {
          dispatch({ type: 'SET_ERROR', error: res.error ?? 'Failed to update test type' })
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
      } else if (result.error?.includes('already exists')) {
        dispatch({ type: 'SET_ERROR', error: 'A draft already exists for this video. Close and reopen to continue.' })
      } else {
        dispatch({ type: 'SET_ERROR', error: result.error ?? 'Failed to create draft' })
      }
    })
  }, [state.draftTestId, state.config, siteId, video.id, video.title, referenciaDados])

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

  // Recusa do servidor ao iniciar: as duas frases do mockup (D-7) no lugar do texto cru; outro erro segue como estava.
  const falhouAoIniciar = useCallback((res: ResultadoIniciar) => {
    if (res.codigo === 'teste_youtube' || res.codigo === 'guarda_falhou') {
      setRecusa({ codigo: res.codigo, ate: res.codigo === 'teste_youtube' && res.ate ? res.ate : null })
      dispatch({ type: 'SET_ERROR', error: null })
      return
    }
    setRecusa(null)
    dispatch({ type: 'SET_ERROR', error: res.error ?? 'Failed to start test' })
  }, [])

  // Edição ou troca de passo invalida a recusa: as versões só são gravadas em `handleSubmit`, então "Tentar de novo" com versões editadas iniciaria as velhas.
  const editar = useCallback((acao: WizardAction) => { setRecusa(null); dispatch(acao) }, [])

  // --- Launch / save handler ---
  const handleSubmit = useCallback((isLaunch: boolean) => {
    setRecusa(null)
    dispatch({ type: 'SET_ERROR', error: null })
    dispatch({ type: 'SET_LAUNCHING', isLaunching: true })

    startTransition(async () => {
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
          dispatch({ type: 'SET_ERROR', error: result.error ?? 'Failed to create test' })
          dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
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
          v.thumbFile || v.thumbUrl?.startsWith('data:') || v.origem === 'biblioteca',
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
              console.warn(e)
              dispatch({ type: 'SET_ERROR', error: 'Failed to download library image' })
              dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
              return
            }
            if (!TIPOS_DA_BIBLIOTECA.includes(blob.type) || blob.size > LIMITE_DA_BIBLIOTECA_BYTES) {
              dispatch({ type: 'SET_ERROR', error: FRASE_BIBLIOTECA_INVALIDA })
              dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
              return
            }
            daBiblioteca.set(v.label, blob)
          }

          const cleanupRes = await cleanupDraftVariants(testId, { manter: gravadasMantidas.map(v => v.label) })
          if (!cleanupRes.ok) {
            dispatch({ type: 'SET_ERROR', error: cleanupRes.error ?? 'Failed to clean up draft' })
            dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
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
              dispatch({ type: 'SET_ERROR', error: uploadResult.error ?? 'Failed to upload variant' })
              dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
              return
            }
            if (uploadResult.variantId) {
              // O arquivo já subiu: não sobe de novo num "Tentar de novo" (a Biblioteca deixa de ser origem; o `data:` fica de prévia)
              marcarGravada(v.label, uploadResult.variantId, v.titleText.trim(), { thumbFile: null, thumbDataUrl: null })
            }
          }

          // Combo reaberto: título editado de uma imagem já gravada
          if (state.type === 'combo') {
            for (const v of gravadasMantidas) {
              if (v.titleText.trim() === (v.textoGravado ?? '')) continue
              const upd = await updateTextVariant(v.gravada!, { title_text: v.titleText.trim() })
              if (!upd.ok) {
                dispatch({ type: 'SET_ERROR', error: upd.error ?? 'Failed to update variant' })
                dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
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
          dispatch({ type: 'SET_ERROR', error: cleanupRes.error ?? 'Failed to clean up draft' })
          dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
          return
        }

        for (const tv of comTexto) {
          const texto = tv.titleText.trim()
          if (tv.gravada) {
            if (texto === (tv.textoGravado ?? '')) continue
            const upd = await updateTextVariant(tv.gravada, { title_text: texto })
            if (!upd.ok) {
              dispatch({ type: 'SET_ERROR', error: upd.error ?? 'Failed to update text variant' })
              dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
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
            dispatch({ type: 'SET_ERROR', error: textResult.error ?? 'Failed to create text variant' })
            dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
            return
          }
          if (textResult.id) marcarGravada(tv.label, textResult.id, texto)
        }
      }

      // 4. Optionally launch
      if (isLaunch) {
        const startResult = await iniciarTeste(testId)
        if (!startResult.ok) {
          falhouAoIniciar(startResult)
          dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
          return
        }
      }

      draftCleared.current = true
      clearDraft(video.id)
      if (isLaunch) {
        // Keep isLaunching=true so the wizard stays in "Ativando..." state
        // until navigation completes — avoids flashing back to the dashboard.
        onCreated(testId)
      } else {
        dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
        onClose()
      }
    })
  }, [state.draftTestId, state.type, state.variants, state.config, siteId, video.id, video.title, referenciaDados, onCreated, onClose, iniciarTeste, falhouAoIniciar])

  // "Tentar de novo": só o início (rascunho e versões já estão gravados; repetir o resto duplicaria versões de título).
  const tentarIniciarDeNovo = useCallback(() => {
    const testId = state.draftTestId
    if (!testId) return
    setRecusa(null)
    dispatch({ type: 'SET_ERROR', error: null })
    dispatch({ type: 'SET_LAUNCHING', isLaunching: true })
    startTransition(async () => {
      const r = await iniciarTeste(testId)
      if (!r.ok) {
        falhouAoIniciar(r)
        dispatch({ type: 'SET_LAUNCHING', isLaunching: false })
        return
      }
      draftCleared.current = true
      clearDraft(video.id)
      onCreated(testId)
    })
  }, [state.draftTestId, iniciarTeste, falhouAoIniciar, video.id, onCreated])

  // --- Step navigation helpers ---
  const canAdvance = stepIsValid(state.step, state)
  const goBack = () => {
    editar({ type: 'SET_STEP', step: passoAnterior(state.step) })
  }
  const goNext = () => {
    editar({ type: 'SET_STEP', step: proximoPasso(state.step) })
  }

  // --- Render current step ---
  function renderStep() {
    switch (state.step) {
      case 'tipo':
        return (
          <StepTipo
            selected={state.type}
            onSelect={handleTypeSelect}
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
          />
        )
      default:
        return null
    }
  }

  return (
    <YtPortal>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      style={{ backdropFilter: 'blur(6px)' }}
      onClick={state.isLaunching ? undefined : onClose}
    >
      <div
        ref={refDialogo}
        role="dialog"
        aria-modal="true"
        aria-label="Novo Teste A/B"
        className="flex flex-col mx-4 animate-ab-fade-up"
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
          <button onClick={onClose} disabled={state.isLaunching} className="text-cms-text-dim p-[4px] shrink-0 disabled:opacity-40" style={{ background: 'transparent', border: 'none' }} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        {/* Step rail */}
        <StepRail currentStep={state.step} onStepClick={s => editar({ type: 'SET_STEP', step: s })} />

        {/* Body */}
        <div key={state.step} className="flex-1 overflow-y-auto p-[24px]" style={{ animation: 'fadeIn 150ms ease-out' }}>
          {isPending && state.step === 'tipo' && (
            <div className="absolute inset-0 flex items-center justify-center bg-cms-surface/80 rounded-lg z-10">
              <p className="text-xs text-cms-text-dim animate-pulse">Criando rascunho...</p>
            </div>
          )}
          {renderStep()}
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
                  <button type="button" onClick={tentarIniciarDeNovo} disabled={state.isLaunching} className="ml-[10px] underline font-semibold">
                    {FRASES.guarda.tentarDeNovo}
                  </button>
                ) : null}
              </span>
            ) : state.error ? (
              <span className="text-red-400">{state.error}</span>
            ) : (
              `Passo ${indiceDoPasso(state.step) + 1} de ${PASSOS.length}`
            )}
          </span>
          <div className="flex flex-col-reverse min-[480px]:flex-row min-[480px]:items-center min-[480px]:justify-end gap-[10px] w-full min-[480px]:w-auto ml-auto">
            {state.step === 'tipo' ? (
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim"
                style={{ border: '1px solid var(--cms-border, #332D25)' }}
              >
                Cancelar
              </button>
            ) : (
              <button
                onClick={goBack}
                disabled={isPending || state.isLaunching}
                className="inline-flex items-center justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim disabled:opacity-40"
                style={{ border: '1px solid var(--cms-border, #332D25)' }}
              >
                Voltar
              </button>
            )}
            {state.step !== 'revisar' && (
              <button
                onClick={goNext}
                disabled={!canAdvance || isPending}
                className="inline-flex items-center gap-[7px] justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] w-full min-[480px]:w-auto whitespace-nowrap transition-[0.15s] tracking-[-0.01em] bg-cms-accent disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ border: '1px solid var(--cms-accent)', color: 'rgb(26,18,12)' }}
              >
                Próximo
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            {state.step === 'revisar' && (
              <>
                <button
                  onClick={() => handleSubmit(false)}
                  disabled={isPending || state.isLaunching}
                  className="inline-flex items-center justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] whitespace-nowrap transition-[0.15s] tracking-[-0.01em] text-cms-text-dim disabled:opacity-40"
                  style={{ border: '1px solid var(--cms-border, #332D25)' }}
                >
                  {isPending ? 'Salvando...' : 'Salvar rascunho'}
                </button>
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={isPending || state.isLaunching}
                  className="inline-flex items-center gap-[7px] justify-center py-[9px] px-[15px] text-[13.5px] font-semibold rounded-[9px] w-full min-[480px]:w-auto whitespace-nowrap transition-[0.15s] tracking-[-0.01em] bg-cms-accent disabled:opacity-40"
                  style={{ border: '1px solid var(--cms-accent)', color: 'rgb(26,18,12)' }}
                >
                  <Play size={14} aria-hidden="true" />
                  {isPending ? 'Ativando...' : 'Ativar teste'}
                </button>
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
/*  Step rail (sub-component)                                          */
/* ------------------------------------------------------------------ */

function StepRail({ currentStep, onStepClick }: { currentStep: Passo; onStepClick: (step: Passo) => void }) {
  const atual = indiceDoPasso(currentStep)
  return (
    <div className="flex items-center py-[16px] px-[24px] shrink-0" style={{ borderBottom: '1px solid var(--cms-border, #332D25)' }}>
      {PASSOS.map((passo, visualIdx) => {
        const label = ROTULO_DO_PASSO[passo]
        const isCompleted = atual > visualIdx
        const isActive = atual === visualIdx
        const isFuture = atual < visualIdx
        return (
          <div key={passo} className="contents">
            <div
              className="flex items-center gap-[9px]"
              style={{ cursor: isFuture ? 'default' : 'pointer' }}
              onClick={() => !isFuture && onStepClick(passo)}
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
