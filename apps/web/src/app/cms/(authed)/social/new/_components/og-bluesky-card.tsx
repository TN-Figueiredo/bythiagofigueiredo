'use client'

interface OgBlueskyCardProps {
  imageUrl: string | null
  title: string
  description: string
  domain: string
}

export function OgBlueskyCard({
  imageUrl,
  title,
  description,
  domain,
}: OgBlueskyCardProps) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
      {/* Image — 2:1 ratio */}
      <div className="relative aspect-[2/1] w-full bg-gray-700">
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
      <div className="space-y-1 px-3 py-2">
        <p className="line-clamp-1 text-sm font-semibold text-gray-200">
          {title || 'Untitled'}
        </p>
        <p className="line-clamp-2 text-xs text-gray-400">
          {description || 'No description'}
        </p>
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          {/* Globe icon */}
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
            />
          </svg>
          <span>{domain}</span>
        </div>
      </div>
    </div>
  )
}
