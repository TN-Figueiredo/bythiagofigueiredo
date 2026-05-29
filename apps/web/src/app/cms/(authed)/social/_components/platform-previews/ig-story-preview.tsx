'use client'

interface IgStoryPreviewProps {
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  className?: string
}

export function IgStoryPreview({ imageUrl, accountName, avatarUrl, className = '' }: IgStoryPreviewProps) {
  return (
    <div className={`relative mx-auto w-[270px] rounded-2xl bg-black overflow-hidden ${className}`} style={{ aspectRatio: '9/16' }}>
      <div className="absolute top-2 left-3 right-3 flex gap-1 z-10">
        <div className="h-0.5 flex-1 rounded-full bg-white/80" />
      </div>
      <div className="absolute top-5 left-3 right-3 flex items-center gap-2 z-10">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-500 p-0.5">
          <div className="h-full w-full rounded-full bg-black overflow-hidden">
            {avatarUrl && <img src={avatarUrl} alt="" className="h-full w-full object-cover" />}
          </div>
        </div>
        <span className="text-xs font-medium text-white">{accountName}</span>
      </div>
      {imageUrl ? (
        <img src={imageUrl} alt="Story preview" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/40">
          Arte do Canvas
        </div>
      )}
      <div className="absolute bottom-4 left-3 right-3 z-10">
        <div className="rounded-full border border-white/20 bg-black/30 px-4 py-2 text-xs text-white/50 backdrop-blur-sm">
          Envie uma mensagem
        </div>
      </div>
    </div>
  )
}
