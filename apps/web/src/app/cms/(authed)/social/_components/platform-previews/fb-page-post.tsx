'use client'

interface FbPagePostProps {
  caption: string
  imageUrl: string | null
  accountName: string
  avatarUrl?: string | null
  linkUrl?: string | null
  linkTitle?: string | null
  className?: string
}

export function FbPagePost({ caption, imageUrl, accountName, avatarUrl, linkUrl, linkTitle, className = '' }: FbPagePostProps) {
  return (
    <div className={`rounded-xl bg-[#242526] overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 px-4 py-3">
        <div className="h-10 w-10 rounded-full bg-[#3a3b3c] overflow-hidden">
          {avatarUrl && <img src={avatarUrl} alt="" className="h-full w-full object-cover" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{accountName}</p>
          <p className="text-xs text-[#b0b3b8]">Agora</p>
        </div>
      </div>
      {caption && <p className="px-4 pb-3 text-sm text-[#e4e6eb] whitespace-pre-wrap">{caption}</p>}
      {imageUrl && (
        <img src={imageUrl} alt="" className="w-full object-cover" style={{ aspectRatio: '4/5' }} />
      )}
      {linkUrl && (
        <div className="mx-4 my-3 rounded-lg border border-[#3a3b3c] bg-[#3a3b3c]/50 p-3">
          <p className="text-xs text-[#b0b3b8] uppercase">{(() => { try { return new URL(linkUrl).hostname } catch { return linkUrl } })()}</p>
          {linkTitle && <p className="mt-1 text-sm font-medium text-white">{linkTitle}</p>}
        </div>
      )}
      <div className="flex items-center justify-around border-t border-[#3a3b3c] px-4 py-2.5 text-[#b0b3b8]">
        <span className="text-xs font-medium">Curtir</span>
        <span className="text-xs font-medium">Comentar</span>
        <span className="text-xs font-medium">Compartilhar</span>
      </div>
    </div>
  )
}
