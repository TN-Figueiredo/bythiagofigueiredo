'use client'
/**
 * A channel's picture inside the screen's own .av box (R124). The coloured initials stay as the fallback: no picture in
 * the data, or the image failed to load. Decorative on purpose: the channel's name is always written next to it.
 */
import { useState } from 'react'

export function ChannelAvatar({ src, ini, color, ink, as: Tag = 'span', className = 'av' }: {
  src?: string | null; ini: string; color: string; ink?: string; as?: 'span' | 'div'; className?: string
}) {
  const [failed, setFailed] = useState(false)
  const show = !!src && !failed
  return (
    <Tag className={className} data-avatar={show ? 'img' : 'ini'} aria-hidden="true"
      style={{ background: color, ...(ink ? { color: ink } : null), ...(show ? { overflow: 'hidden', padding: 0 } : null) }}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube's own avatar host; a 40 px decorative image does not need the optimizer
        <img src={src} alt="" width={88} height={88} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 'inherit' }} />
      ) : ini}
    </Tag>
  )
}
