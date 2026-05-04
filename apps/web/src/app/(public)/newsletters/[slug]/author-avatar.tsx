'use client'

import { useState } from 'react'

export function AuthorAvatar({
  src,
  name,
  size = 80,
}: {
  src: string | null
  name: string
  size?: number
}) {
  const [errored, setErrored] = useState(false)
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

  if (!src || errored) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: '2px solid var(--pb-line)',
          background: 'linear-gradient(135deg, var(--nl-accent, #6366f1), var(--pb-marker, #8b5cf6))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-fraunces-var), serif',
          fontSize: size * 0.3,
          fontWeight: 600,
          color: '#1A140C',
        }}
      >
        {initials}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      style={{
        borderRadius: '50%',
        objectFit: 'cover',
        border: '2px solid var(--pb-line)',
      }}
      onError={() => setErrored(true)}
    />
  )
}
