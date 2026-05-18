import type { YtVideoGrade } from '@/lib/youtube/analytics-types'

interface Props {
  grades: YtVideoGrade[]
}

const GRADE_COLORS: Record<string, string> = {
  A: '#34d399',
  B: '#60a5fa',
  C: '#fbbf24',
  D: '#f87171',
}

export function YtGrades({ grades }: Props) {
  if (grades.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-cms-border p-8 text-center">
        <p className="text-sm text-cms-text-muted">
          Necessário pelo menos 3 vídeos com mais de 7 dias para gerar notas.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-cms-text">Notas de Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-cms-border text-left text-cms-text-muted">
                <th scope="col" className="pb-2 font-medium">
                  Grade
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Video
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Views (7d)
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {grades.map((v) => (
                <tr key={v.videoId} className="border-b border-cms-border/50 hover:bg-cms-bg/40">
                  <td className="py-2">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{
                        background: `${GRADE_COLORS[v.grade]}20`,
                        color: GRADE_COLORS[v.grade],
                      }}
                    >
                      {v.grade}
                    </span>
                  </td>
                  <td className="py-2 font-medium text-cms-text">{v.title}</td>
                  <td className="py-2 text-right tabular-nums text-cms-text">
                    {v.views7d.toLocaleString()}
                  </td>
                  <td
                    className="py-2 text-right tabular-nums font-bold"
                    style={{ color: GRADE_COLORS[v.grade] }}
                  >
                    {v.score.toFixed(1)}×
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
