'use client'

import { AlertTriangle, CheckCircle, CircleHelp, Clock } from 'lucide-react'
import type { TestType, DisplayLabel } from '@/lib/youtube/ab-types'
import type { WizardConfig } from '@/lib/youtube/ab-wizard-adapter'
import { tetoMinimo, tetoPadrao } from '@/lib/youtube/ab-gravacao/decisao-v2'
import { NOTA_ATIVAR, tituloDoBanner, type AvisoOriginal, type EstadoAviso } from '@/lib/youtube/ab-original-resolucao'
import { InfoDica } from '../../_components/info-dica'
import type { EstadoAvisoVolume } from './use-aviso-volume'
import { seloDoAvisoDeVolume } from './aviso-volume-selo'
import { VARIANT_COLORS, TYPE_META, ROTULO_TIPO_DESCONHECIDO_CURTO } from './ab-constants'
import { ClickMoment } from './click-moment'
import { previaPorTipo, descricaoDaPrevia } from './previa-por-tipo'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ReviewVariant {
  label: DisplayLabel
  thumbUrl: string | null
  title: string
  isOriginal: boolean
}

export interface StepRevisarProps {
  type: TestType
  variants: ReviewVariant[]
  config: WizardConfig
  /** Dado real do vídeo para os cartões da prévia; null some da tela. */
  meta: { canal: string | null; publicadoEm: string | null; duracao: string | null }
  /** Variante sem imagem pode ser preenchida da Biblioteca (só testes de thumbnail e combo). */
  onEscolherDaBiblioteca?: (label: DisplayLabel) => void
  /** D12: estado da leitura da resolução da original (undefined = não se aplica). */
  avisoOriginal?: EstadoAviso
  /** Aviso de volume da regra nova (D-M6-9): pendente, indisponível, cartão ou nada. Nunca bloqueia o botão. */
  avisoVolume?: EstadoAvisoVolume
  /** 1ª variante de thumbnail sem imagem: o banner pede a imagem e a nota explica por que Ativar está desativado. */
  faltaThumb?: DisplayLabel | null
  /** Salvando ou ativando: a nota some (a espera já aparece no rodapé do corpo). */
  ocupado?: boolean
  /** Falha ao ativar: a nota some (a mensagem de erro já diz o que fazer). */
  comErro?: boolean
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const TYPE_LABELS_PT: Record<TestType, string> = {
  thumbnail:   'thumbnail',
  title:       'título',
  combo:       'título + thumbnail',
}

/** Resumo do banner: só o que o banner sabe dizer; prazo e rotação moram na linha da regra. */
function buildSummaryText(variants: ReviewVariant[], type: TestType): string {
  return `${variants.length} variantes de ${TYPE_LABELS_PT[type as TestType] ?? ROTULO_TIPO_DESCONHECIDO_CURTO}`
}

/** Texto 8: a regra numa linha. `seq` é a sequência de blocos da rotação ABBA (`ab-rotation.ts:12`). */
function RegraDoTeste({ V }: { V: number }) {
  const teto = tetoPadrao(V)
  const minimo = tetoMinimo(V)
  const seq = V >= 3 ? 'A, B, C, C, B, A' : 'A, B, B, A'
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-1 text-[13px] leading-snug text-cms-text-muted" data-regra>
      <span>Roda até {teto} dias (mínimo {minimo}), em rotação ABBA. Quem escolhe o vencedor é você.</span>
      <InfoDica
        rotulo={`Por que ${teto} dias`}
        titulo={`Por que ${teto} dias`}
        paragrafos={[
          `O YouTube leva dias para enviar o alcance de cada vídeo; por isso o prazo é fixo: no mínimo ${minimo} e no máximo ${teto} dias.`,
          `A rotação ABBA alterna as versões em blocos (${seq}) para que cada uma passe por dias parecidos.`,
        ]}
      />
    </p>
  )
}

/** Inicial maiúscula e ponto final (os textos do servidor vêm em minúscula e sem ponto; o Cowork lê a mesma frase). */
function fraseDeTela(t: string): string {
  const f = t.charAt(0).toUpperCase() + t.slice(1)
  return /[.!?]$/.test(f) ? f : `${f}.`
}

const TEXTO_VOLUME_INDISPONIVEL = 'Não foi possível estimar o volume agora. Você pode ativar mesmo assim.'

/* ------------------------------------------------------------------ */
/*  AvisoResolucao (D12)                                               */
/* ------------------------------------------------------------------ */

type AvisoComSelo = Exclude<AvisoOriginal, { kind: 'indisponivel' }>

function CartaoDeAviso({ selo, ambar, texto, tracejado = false, atributo }: { selo: string; ambar: boolean; texto: string; tracejado?: boolean; atributo?: Record<string, string> }) {
  return (
    <div
      role="status"
      {...atributo}
      className={`rv-vol ${ALTURA_AVISO_VOLUME} grid content-center justify-items-start gap-2 rounded-lg border border-cms-border bg-cms-surface px-4 py-3 text-[13px] leading-[1.55] text-cms-text`}
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-px text-[12px] font-semibold leading-5 ${ambar ? '' : 'bg-cms-surface-3 text-cms-text-muted'}`}
        style={ambar
          ? { color: 'var(--cms-amber-text)', borderColor: 'var(--cms-amber-line)', background: 'var(--cms-amber-soft)' }
          : { border: '1px dashed var(--theme-cms-text-dim)' }}
        data-tracejado={tracejado || !ambar ? 'true' : undefined}
      >
        {ambar
          ? <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          : <CircleHelp className="w-3.5 h-3.5" aria-hidden="true" />}
        {selo}
      </span>
      <p className="m-0 max-w-[78ch]">{texto}</p>
    </div>
  )
}

function AvisoResolucao({ aviso }: { aviso: AvisoComSelo }) {
  return <CartaoDeAviso selo={aviso.selo} ambar={aviso.kind === 'baixa'} texto={aviso.texto} />
}

/** Mesma altura mínima do cartão de aviso com uma linha: a troca de pendente para resolvido não empurra a página. */
const ALTURA_AVISO_VOLUME = 'min-h-[92px]'

function EsqueletoDeAviso({ texto, rotulo, atributo }: { texto: string; rotulo: string; atributo?: boolean }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={rotulo}
      {...(atributo ? { 'data-aviso-volume-sk': '' } : {})}
      className={`rv-vol ${ALTURA_AVISO_VOLUME} grid content-center gap-2 rounded-lg border border-cms-border bg-cms-surface px-4 py-3 text-[13px] leading-[1.55] text-cms-text-muted`}
    >
      <span className="inline-flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" aria-hidden="true" />
        {texto}
      </span>
      <span className="block h-2 w-3/5 rounded bg-cms-surface-3 motion-safe:animate-pulse" aria-hidden="true" />
    </div>
  )
}

function AvisoVolume({ estado }: { estado: Exclude<EstadoAvisoVolume, null> }) {
  if (estado === 'pendente') return <EsqueletoDeAviso texto="Conferindo o volume do vídeo…" rotulo="Estimando o volume do teste" atributo />
  if (estado === 'indisponivel') {
    return <p role="status" data-aviso-volume className="m-0 text-[13px] text-cms-text-muted">{TEXTO_VOLUME_INDISPONIVEL}</p>
  }
  const selo = seloDoAvisoDeVolume(estado.estado)
  if (!selo) return <p role="status" data-aviso-volume className="m-0 text-[13px] text-cms-text-muted">{fraseDeTela(estado.texto)}</p>
  return <CartaoDeAviso selo={selo.selo} ambar={selo.tom === 'ambar'} texto={fraseDeTela(estado.texto)} atributo={{ 'data-aviso-volume': '' }} />
}

/* ------------------------------------------------------------------ */
/*  StepRevisar                                                        */
/* ------------------------------------------------------------------ */

export function StepRevisar({ type, variants, meta, onEscolherDaBiblioteca, avisoOriginal, avisoVolume, faltaThumb, ocupado = false, comErro = false }: StepRevisarProps) {
  const summaryText = buildSummaryText(variants, type)
  const titulo = tituloDoBanner(avisoOriginal, { volume: avisoVolume, faltaThumb })
  const pronto = titulo === 'Tudo pronto.'
  const clickMomentVariants = previaPorTipo(type, variants).map(c => ({
    label: c.label,
    color: VARIANT_COLORS[c.label],
    ctr: null,
    thumbUrl: c.thumbUrl,
    title: c.title,
  }))
  const winnerLabel = variants.length > 1 ? variants[variants.length - 1]!.label : 'A'
  const winnerColor = VARIANT_COLORS[winnerLabel as DisplayLabel] ?? VARIANT_COLORS.A

  return (
    <div className="space-y-5">

      {/* Banner: verde só quando tudo foi lido e não há o que dizer (D-M6-8) */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        data-tom={pronto ? 'verde' : 'neutro'}
        style={{
          borderRadius: 12,
          background: pronto ? 'var(--cms-ban-bg)' : 'var(--cms-surface)',
          border: `1px solid ${pronto ? 'var(--cms-ban-bd)' : 'var(--cms-border)'}`,
        }}
      >
        {faltaThumb
          ? <AlertTriangle className="w-5 h-5 shrink-0 text-cms-text-muted" aria-hidden="true" />
          : <CheckCircle className={`w-5 h-5 shrink-0 ${pronto ? 'text-[var(--cms-green-icon)]' : 'text-cms-text-muted'}`} aria-hidden="true" />}
        <p className="text-[13px] leading-snug text-cms-text m-0">
          <strong className={`font-semibold ${pronto ? 'text-[var(--cms-green-text)]' : 'text-cms-text'}`}>{titulo}</strong>{' '}
          <span className="text-cms-text">{faltaThumb ? 'Escolha uma imagem da Biblioteca para poder ativar o teste.' : summaryText}</span>
        </p>
      </div>

      <RegraDoTeste V={variants.length} />

      {avisoOriginal === 'pendente' ? (
        <EsqueletoDeAviso texto="Conferindo a resolução da miniatura original…" rotulo="Lendo a resolução da original" />
      ) : avisoOriginal ? (
        avisoOriginal.kind === 'indisponivel' ? (
          <p role="status" className="m-0 text-[13px] text-cms-text-muted">{avisoOriginal.texto}</p>
        ) : (
          <AvisoResolucao aviso={avisoOriginal} />
        )
      ) : null}

      {avisoVolume ? <AvisoVolume estado={avisoVolume} /> : null}

      {/* ClickMoment preview — only when 2+ variants */}
      {variants.length >= 2 && (
        <ClickMoment
          winnerLabel={winnerLabel as DisplayLabel}
          winnerColor={winnerColor}
          variants={clickMomentVariants}
          semCtr
          semVencedor
          meta={meta}
          descricao={descricaoDaPrevia(type, variants.length)}
          onEscolherDaBiblioteca={type === 'thumbnail' || type === 'combo' ? onEscolherDaBiblioteca : undefined}
        />
      )}

      {/* Nota: some durante salvar/ativar e no erro */}
      {ocupado || comErro ? null : faltaThumb ? (
        <p data-nota-ativar className="text-[12px] text-cms-text-dim text-center leading-snug px-2 m-0">
          <strong className="text-cms-text-muted">Ativar teste</strong> está desativado: a variante {faltaThumb} ainda não tem thumbnail.
        </p>
      ) : (
        <p data-nota-ativar className="text-[12px] text-cms-text-dim text-center leading-snug px-2 m-0">
          {NOTA_ATIVAR.split('Ativar teste')[0]}
          <strong className="text-cms-text-muted">Ativar teste</strong>
          {NOTA_ATIVAR.split('Ativar teste')[1]}
        </p>
      )}

    </div>
  )
}
