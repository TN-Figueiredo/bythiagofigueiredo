'use client'

interface OgFacebookCardProps {
  imageUrl: string | null
  title: string
  description: string
  domain: string
}

export function OgFacebookCard({
  imageUrl,
  title,
  description,
  domain,
}: OgFacebookCardProps) {
  return (
    <div className="w-full overflow-hidden rounded-none border border-gray-700 bg-gray-800">
      {/* Image — 1.91:1 ratio */}
      <div className="relative aspect-[1.91/1] w-full bg-gray-700">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="OG preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-gray-500">
            No og:image
          </div>
        )}
      </div>

      {/* Text content */}
      <div className="space-y-0.5 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
          {domain}
        </p>
        <p className="line-clamp-2 text-sm font-bold leading-tight text-gray-200">
          {title || 'Untitled'}
        </p>
        <p className="line-clamp-1 text-xs text-gray-400">
          {description || 'No description'}
        </p>
      </div>
    </div>
  )
}
