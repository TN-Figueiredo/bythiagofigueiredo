'use client'

import { Lock, Pencil } from 'lucide-react'
import { brDec } from '@/lib/youtube/format'
import {
  dataHoraDePublicacao, duracaoDoVideo, textoDeVisualizacoes,
} from '@/lib/youtube/ab-linha-video'
import type { EligibleVideo } from './video-picker-dialog'
import type { WizardVideo } from './ab-create-wizard'
import './linha-de-video.css'

/** Motivo (texto 22 do plano M6) por que a linha não pode ser escolhida; null = escolhível. */
export function motivoDoBloqueio(v: EligibleVideo, podeContinuar = false): string | null {
  if (v.statusDoTeste === 'draft') return podeContinuar && v.rascunhoId ? null : 'Já tem um rascunho'
  if (v.statusDoTeste !== null || v.hasActiveTest) return 'Teste ativo em andamento'
  if (v.bloqueio === 'short') return 'Shorts não entram no A/B Lab'
  if (v.bloqueio === 'sem_thumb_hq') return 'Sincronize o vídeo em Vídeos antes'
  return null
}

const TIPO_RASCUNHO: Record<string, string> = { title: 'Título', thumbnail: 'Miniatura', combo: 'Título e miniatura' }

/** "Rascunho de DD/MM · Tipo"; só o que existe (sem data válida, sem tipo conhecido, não inventa). */
export function rotuloDoRascunho(criadoEm: string | null | undefined, tipo: string | null | undefined): string | null {
  const data = criadoEm && !Number.isNaN(Date.parse(criadoEm))
    ? new Date(criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
    : null
  const t = tipo ? (TIPO_RASCUNHO[tipo] ?? null) : null
  if (!data && !t) return null
  return `Rascunho${data ? ` de ${data}` : ''}${t ? ` · ${t}` : ''}`
}

function dataValida(iso: string | null): iso is string {
  return iso !== null && !Number.isNaN(Date.parse(iso))
}

/** Uma linha do seletor de vídeo. Mostra só o que existe: nada de número ou data inventados. */
export function LinhaDeVideo({ video, onEscolher, onContinuarRascunho }: { video: EligibleVideo; onEscolher: (v: WizardVideo) => void; onContinuarRascunho?: (draftId: string) => void }) {
  const continuar = onContinuarRascunho !== undefined && video.statusDoTeste === 'draft' && Boolean(video.rascunhoId) ? video.rascunhoId! : null
  const motivo = motivoDoBloqueio(video, onContinuarRascunho !== undefined)
  const rotulo = continuar ? rotuloDoRascunho(video.rascunhoCriadoEm, video.rascunhoTipo) : null
  const duracao = duracaoDoVideo(video.durationSeconds)
  return (
    <button
      type="button"
      className="vp"
      disabled={motivo !== null}
      onClick={() => {
        if (continuar) { onContinuarRascunho!(continuar); return }
        onEscolher({
          id: video.id,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          sourcePipelineId: video.sourcePipelineId,
          durationSeconds: video.durationSeconds,
          publishedAt: video.publishedAt,
          channelHandle: video.channelHandle,
        })
      }}
    >
      <span className={`th${video.thumbnailUrl ? '' : ' semimg'}`}>
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span className="text-cms-text-muted">Sem miniatura</span>
        )}
      </span>
      <span className="tx">
        <span className="t line-clamp-2">{video.title}</span>
        <span className="m">
          {duracao && <span>Duração {duracao}</span>}
          <span>{dataValida(video.publishedAt) ? `Publicado em ${dataHoraDePublicacao(video.publishedAt)}` : 'Data de publicação não informada'}</span>
          {video.viewCount !== null && video.viewCount > 0 && <span>{textoDeVisualizacoes(video.viewCount)}</span>}
        </span>
        {motivo && (
          <span className="amb">
            <Lock size={12} aria-hidden="true" />
            {motivo}
          </span>
        )}
        {continuar && rotulo && <span className="m" data-rascunho-origem>{rotulo}</span>}
        {continuar && (
          <span className="acao" data-continuar-rascunho>
            <Pencil size={13} aria-hidden="true" />
            Continuar rascunho
          </span>
        )}
        {video.previousLift != null && (
          <span className="lf">Lift anterior: {video.previousLift > 0 ? '+' : ''}{brDec(video.previousLift, 1)}%</span>
        )}
      </span>
    </button>
  )
}
