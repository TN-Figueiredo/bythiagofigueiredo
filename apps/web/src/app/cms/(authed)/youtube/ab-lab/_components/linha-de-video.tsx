'use client'

import { brDec } from '@/lib/youtube/format'
import {
  dataHoraDePublicacao, duracaoDoVideo, textoDeVisualizacoes,
} from '@/lib/youtube/ab-linha-video'
import type { EligibleVideo } from './video-picker-dialog'
import type { WizardVideo } from './ab-create-wizard'
import './linha-de-video.css'

/** Motivo (texto 22 do plano M6) por que a linha não pode ser escolhida; null = escolhível. */
export function motivoDoBloqueio(v: EligibleVideo): string | null {
  if (v.statusDoTeste === 'draft') return 'Já tem um rascunho'
  if (v.statusDoTeste !== null || v.hasActiveTest) return 'Teste ativo em andamento'
  if (v.bloqueio === 'short') return 'Shorts não entram no A/B Lab'
  if (v.bloqueio === 'sem_thumb_hq') return 'Sincronize o vídeo em Vídeos antes'
  return null
}

function dataValida(iso: string | null): iso is string {
  return iso !== null && !Number.isNaN(Date.parse(iso))
}

/** Uma linha do seletor de vídeo. Mostra só o que existe: nada de número ou data inventados. */
export function LinhaDeVideo({ video, onEscolher }: { video: EligibleVideo; onEscolher: (v: WizardVideo) => void }) {
  const motivo = motivoDoBloqueio(video)
  const duracao = duracaoDoVideo(video.durationSeconds)
  return (
    <button
      type="button"
      className="vp"
      disabled={motivo !== null}
      onClick={() =>
        onEscolher({
          id: video.id,
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          sourcePipelineId: video.sourcePipelineId,
          durationSeconds: video.durationSeconds,
          publishedAt: video.publishedAt,
          channelHandle: video.channelHandle,
        })
      }
    >
      <span className={`th${video.thumbnailUrl ? '' : ' semimg'}`}>
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnailUrl} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          'Sem thumbnail'
        )}
      </span>
      <span className="tx">
        <span className="t line-clamp-2">{video.title}</span>
        <span className="m">
          {duracao && <span>Duração {duracao}</span>}
          <span>{dataValida(video.publishedAt) ? `Publicado em ${dataHoraDePublicacao(video.publishedAt)}` : 'Data de publicação não informada'}</span>
          {video.viewCount !== null && video.viewCount > 0 && <span>{textoDeVisualizacoes(video.viewCount)}</span>}
        </span>
        {motivo && <span className="amb">{motivo}</span>}
        {video.previousLift != null && (
          <span className="lf">Lift anterior: {video.previousLift > 0 ? '+' : ''}{brDec(video.previousLift, 1)}%</span>
        )}
      </span>
    </button>
  )
}
