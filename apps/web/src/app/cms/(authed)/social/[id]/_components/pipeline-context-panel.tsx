import Link from 'next/link'
import type { PipelineSnapshot } from '@/lib/social/types'

interface PipelineContextPanelProps {
  snapshot: PipelineSnapshot
}

const FORMAT_LABELS: Record<string, string> = {
  blog_post: 'Blog Post',
  newsletter: 'Newsletter',
  campaign: 'Campaign',
  video: 'Vídeo',
}

const LANG_LABELS: Record<string, string> = {
  'pt-br': 'PT-BR',
  en: 'EN',
  both: 'PT + EN',
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    })
  } catch {
    return iso
  }
}

function countFilledSections(sections: Record<string, unknown>): number {
  return Object.values(sections).filter((v) => v != null).length
}

export function PipelineContextPanel({ snapshot }: PipelineContextPanelProps) {
  const formatLabel = FORMAT_LABELS[snapshot.format] ?? snapshot.format
  const langLabel = LANG_LABELS[snapshot.language] ?? snapshot.language
  const filledSections = countFilledSections(snapshot.sections)

  return (
    <section
      aria-label="Pipeline Origin"
      className="rounded-lg border border-cms-border bg-cms-surface p-4 space-y-3"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-cms-text">Pipeline Origin</h3>
        <Link
          href={`/cms/pipeline/${snapshot.format}`}
          className="text-xs text-cms-accent hover:underline"
        >
          Ver pipeline →
        </Link>
      </header>

      <span className="inline-block rounded bg-cms-bg px-2 py-0.5 font-mono text-xs text-cms-text-muted">
        {snapshot.code}
      </span>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <dt className="text-cms-text-muted">Format</dt>
        <dd className="text-cms-text">{formatLabel}</dd>

        <dt className="text-cms-text-muted">Stage</dt>
        <dd className="text-cms-text">{snapshot.stage}</dd>

        <dt className="text-cms-text-muted">Language</dt>
        <dd className="text-cms-text">{langLabel}</dd>

        <dt className="text-cms-text-muted">Version</dt>
        <dd className="text-cms-text tabular-nums">v{snapshot.version}</dd>

        {snapshot.category && (
          <>
            <dt className="text-cms-text-muted">Category</dt>
            <dd className="text-cms-text">{snapshot.category}</dd>
          </>
        )}
      </dl>

      {snapshot.hook && (
        <blockquote className="border-l-2 border-cms-border pl-3 text-xs italic text-cms-text-muted">
          {snapshot.hook}
        </blockquote>
      )}

      {snapshot.synopsis && (
        <p className="text-xs text-cms-text-muted line-clamp-3">{snapshot.synopsis}</p>
      )}

      {snapshot.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {snapshot.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-cms-bg px-2 py-0.5 text-[10px] text-cms-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {filledSections > 0 && (
        <p className="text-xs text-cms-text-muted">
          {filledSections} {filledSections === 1 ? 'seção preenchida' : 'seções preenchidas'}
        </p>
      )}

      {snapshot.cover_image_url && (
        <img
          src={snapshot.cover_image_url}
          alt=""
          className="h-20 w-full rounded-md object-cover"
        />
      )}

      <p className="text-[10px] text-cms-text-muted">
        Graduado em {formatDate(snapshot.graduated_at)}
      </p>
    </section>
  )
}
