'use client'

interface IgFeedPostProps {
  caption: string
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  className?: string
}

export function IgFeedPost({ caption, imageUrl, accountName, avatarUrl, className = '' }: IgFeedPostProps) {
  return (
    <div className={`rounded-xl bg-black overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-500 p-0.5">
          <div className="h-full w-full rounded-full bg-black overflow-hidden">
            {avatarUrl && <img src={avatarUrl} alt="" className="h-full w-full object-cover" />}
          </div>
        </div>
        <span className="text-sm font-medium text-white">{accountName}</span>
      </div>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="w-full object-cover" style={{ aspectRatio: '4/5' }} />
      ) : (
        <div className="flex items-center justify-center bg-[#1a1a1a] text-sm text-white/30" style={{ aspectRatio: '4/5' }}>
          Imagem
        </div>
      )}
      <div className="flex items-center gap-4 px-3 py-2.5 text-white">
        <span className="text-lg">&#9825;</span>
        <span className="text-lg">&#128172;</span>
        <span className="text-lg">&#9993;</span>
      </div>
      {caption && (
        <div className="px-3 pb-3">
          <p className="text-sm text-white">
            <span className="font-medium">{accountName}</span>{' '}
            <span className="text-white/90">{caption}</span>
          </p>
        </div>
      )}
    </div>
  )
}
