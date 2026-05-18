'use client'

interface OgInstagramPreviewProps {
  imageUrl: string | null
  title: string
  ctaText?: string
}

export function OgInstagramPreview({
  imageUrl,
  title,
  ctaText = 'Link na bio',
}: OgInstagramPreviewProps) {
  return (
    <div className="mx-auto w-full max-w-[200px] overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
      {/* Story frame — 9:16 ratio miniature */}
      <div className="relative aspect-[9/16] w-full bg-gray-800">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Story preview"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 opacity-30" />
          </div>
        )}

        {/* CTA overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-4">
          <p className="mb-1 line-clamp-2 text-center text-[10px] font-semibold text-white">
            {title || 'Title'}
          </p>
          <div className="mx-auto w-fit rounded-full bg-white/90 px-3 py-1">
            <p className="text-[9px] font-bold text-gray-900">{ctaText}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
