import type { YtDemographics } from '@/lib/youtube/analytics-types'

interface Props {
  demographics: YtDemographics
}

export function YtDemographicsView({ demographics }: Props) {
  if (demographics.ageGender.length === 0 && demographics.countries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-cms-border p-8 text-center">
        <p className="text-sm text-cms-text-muted">
          Connect YouTube Analytics to see demographics data.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {demographics.ageGender.length > 0 && (
        <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
          <h3 className="mb-3 text-sm font-semibold text-cms-text">Age &amp; Gender</h3>
          <div className="space-y-2">
            {demographics.ageGender.map((ag) => (
              <div key={ag.ageGroup} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-cms-text-muted">{ag.ageGroup}</span>
                <div className="flex flex-1 gap-0.5">
                  <div
                    className="h-4 rounded-l bg-blue-400/80"
                    style={{ width: `${ag.male}%` }}
                  />
                  <div
                    className="h-4 rounded-r bg-pink-400/80"
                    style={{ width: `${ag.female}%` }}
                  />
                </div>
                <span className="w-10 text-right tabular-nums text-cms-text-muted">
                  {Math.round(ag.male + ag.female)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {demographics.countries.length > 0 && (
          <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
            <h3 className="mb-3 text-sm font-semibold text-cms-text">Top Countries</h3>
            <div className="space-y-2">
              {demographics.countries.map((c) => (
                <div key={c.country} className="flex items-center justify-between text-xs">
                  <span className="text-cms-text">{c.country}</span>
                  <span className="tabular-nums text-cms-text-muted">{c.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {demographics.devices.length > 0 && (
          <div className="rounded-lg border border-cms-border bg-cms-surface p-4">
            <h3 className="mb-3 text-sm font-semibold text-cms-text">Device Types</h3>
            <div className="space-y-2">
              {demographics.devices.map((d) => (
                <div key={d.deviceType} className="flex items-center justify-between text-xs">
                  <span className="text-cms-text capitalize">{d.deviceType}</span>
                  <span className="tabular-nums text-cms-text-muted">{d.percentage}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
