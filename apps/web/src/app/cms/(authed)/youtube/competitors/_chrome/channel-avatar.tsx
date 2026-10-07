'use client'
/**
 * A channel's picture inside the screen's own .av box (R124). The coloured initials stay as the fallback: no picture in
 * the data, or the image failed to load. Decorative on purpose: the channel's name is always written next to it.
 */
import { useEffect, useRef, useState } from 'react'

export function ChannelAvatar({ src, ini, color, ink, as: Tag = 'span', className = 'av' }: {
  src?: string | null; ini: string; color: string; ink?: string; as?: 'span' | 'div'; className?: string
}) {
  // the src that failed, not a flag: when the same instance is reused for another channel (pager, drawer) or a sync refreshes
  // the URL, the new picture gets its own chance
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const img = useRef<HTMLImageElement>(null)
  const show = !!src && failedSrc !== src
  // an image that errored before hydration never fires onError: check the element once it is mounted
  useEffect(() => { const el = img.current; if (el && src && el.complete && el.naturalWidth === 0) setFailedSrc(src) }, [src])
  return (
    <Tag className={className} data-avatar={show ? 'img' : 'ini'} aria-hidden="true"
      style={{ background: color, ...(ink ? { color: ink } : null), ...(show ? { overflow: 'hidden', padding: 0 } : null) }}>
      {show ? (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube's own avatar host; a 40 px decorative image does not need the optimizer
        <img src={src} alt="" width={88} height={88} loading="lazy" decoding="async" referrerPolicy="no-referrer" ref={img} onError={() => setFailedSrc(src ?? null)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 'inherit' }} />
      ) : ini}
    </Tag>
  )
}
