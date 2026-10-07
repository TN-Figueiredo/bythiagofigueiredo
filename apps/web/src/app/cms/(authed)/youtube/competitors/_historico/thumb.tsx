/**
 * A thumbnail of one version: the archived image (Vercel Blob) when there is one, otherwise the honest text.
 * The mockup's drawn placeholders are never shown as if they were the real image.
 */
import type { ThumbImg } from './view-model'

/** `w`/`h` are the intrinsic size the box reserves before the image arrives (16:9); the CSS still sizes the box. */
export function Thumb({ t, dur, w = 320, h = 180, alt }: { t: ThumbImg; dur?: string | null; w?: number; h?: number; alt?: string }) {
  if (!t.src) return <div className="th missing" data-thumb-missing=""><span>{t.missing}</span></div>
  return (
    <div className="th" data-thumb="">
      {/* eslint-disable-next-line @next/next/no-img-element -- archived blob of any host; next/image would need every blob host configured */}
      <img src={t.src} alt={alt ?? t.alt} width={w} height={h} loading="lazy" />
      {dur ? <span className="dur">{dur}</span> : null}
    </div>
  )
}
