'use client'

interface PollOption {
  text: string
  percentage?: number
}

interface YtCommunityCardProps {
  caption: string
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  poll?: PollOption[]
  className?: string
}

export function YtCommunityCard({ caption, imageUrl, accountName, avatarUrl, poll, className = '' }: YtCommunityCardProps) {
  return (
    <div className={`rounded-xl bg-[#272727] p-4 ${className}`}>
      <div className="mb-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-[#3d3d3d] overflow-hidden">
          {avatarUrl && <img src={avatarUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{accountName}</p>
          <p className="text-xs text-[#aaa]">agora</p>
        </div>
      </div>
      {caption && <p className="mb-3 text-sm text-white whitespace-pre-wrap">{caption}</p>}
      {imageUrl && (
        <div className="mb-3 overflow-hidden rounded-lg">
          <img src={imageUrl} alt="" className="w-full object-cover" style={{ aspectRatio: '1/1' }} />
        </div>
      )}
      {poll && poll.length > 0 && (
        <div className="mb-3 space-y-2">
          {poll.map((opt, i) => (
            <div key={i} className="relative overflow-hidden rounded-lg bg-[#3d3d3d] px-3 py-2">
              {opt.percentage != null && (
                <div className="absolute inset-y-0 left-0 bg-blue-600/30" style={{ width: `${opt.percentage}%` }} />
              )}
              <span className="relative text-sm text-white">{opt.text}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-6 text-[#aaa]">
        <span className="text-xs">Curtir</span>
        <span className="text-xs">Comentar</span>
      </div>
    </div>
  )
}
