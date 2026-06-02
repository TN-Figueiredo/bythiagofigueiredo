import type { YtVideoGrade } from '@/lib/youtube/analytics-types'
import { brDec } from '@/lib/youtube/format'

interface Props {
  grades: YtVideoGrade[]
}

export function YtOutliers({ grades }: Props) {
  const positiveOutliers = grades
    .filter((v) => v.score >= 2)
    .sort((a, b) => b.score - a.score)
  const negativeOutliers = grades
    .filter((v) => v.score < 0.7)
    .sort((a, b) => a.score - b.score)

  if (positiveOutliers.length === 0 && negativeOutliers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-cms-border p-8 text-center">
        <p className="text-sm text-cms-text-muted">
          Nenhum outlier significativo detectado nos uploads recentes.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {positiveOutliers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cms-text">Outliers Positivos</h3>
          {positiveOutliers.map((v) => (
            <div
              key={v.videoId}
              className="rounded-lg border border-cms-border border-l-4 border-l-green-400 bg-cms-surface p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-cms-text">{v.title}</span>
                <span className="text-sm font-bold text-green-400">{brDec(v.score, 1)}× avg</span>
              </div>
              <p className="mt-1 text-xs text-cms-text-muted">
                {v.views7d.toLocaleString('pt-BR')} views
              </p>
            </div>
          ))}
        </div>
      )}
      {negativeOutliers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-cms-text">Abaixo da Média</h3>
          {negativeOutliers.map((v) => (
            <div
              key={v.videoId}
              className="rounded-lg border border-cms-border border-l-4 border-l-red-400 bg-cms-surface p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-cms-text">{v.title}</span>
                <span className="text-sm font-bold text-red-400">{brDec(v.score, 1)}× avg</span>
              </div>
              <p className="mt-1 text-xs text-cms-text-muted">
                {v.views7d.toLocaleString('pt-BR')} views
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
