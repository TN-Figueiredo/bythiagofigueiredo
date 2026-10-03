/**
 * Thumbnail before → after. The archived image (Vercel Blob) when there is one; otherwise an honest note — the
 * mockup's drawn placeholders are never shown as if they were the real image.
 */
import type { ThumbView } from './view-model'
import { Ic } from './icons'

const KEY_TITLE = (k: string) => 'Imagem ' + k + ': cada letra é uma imagem deste vídeo; a mesma letra de novo é a mesma imagem voltando'

function Fig({ t }: { t: ThumbView }) {
  return (
    <figure>
      {t.src
        // eslint-disable-next-line @next/next/no-img-element -- archived blob of any size; next/image would need every blob host configured
        ? <div className="thumb img" data-thumb=""><img src={t.src} alt={'Thumbnail ' + (t.role === 'Antes' ? 'antes' : 'depois') + ', imagem ' + t.label} loading="lazy" /></div>
        : <div className="thumb hatch" data-thumb-missing=""><span><b>Sem a imagem</b>{cap(t.missing ?? '')}</span></div>}
      <figcaption>
        <b>{t.role} · <abbr title={KEY_TITLE(t.label)}>{t.label}</abbr>{t.back ? <span className="th-back"> (mesma imagem voltando)</span> : null}</b>
        <span>{t.period}</span>
      </figcaption>
    </figure>
  )
}
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export function ThumbCompare({ thumbs }: { thumbs: ThumbView[] }) {
  const [a, b] = thumbs
  if (!a || !b) return null
  return (
    <div className="th-pair">
      <Fig t={a} />
      <span className="th-arrow" aria-hidden="true"><Ic name="arrowR" /></span>
      <Fig t={b} />
    </div>
  )
}
