import { toast } from 'sonner'

/**
 * Open Claude (Cowork) with a pre-written instruction via the `claude://` protocol
 * handler. Mirrors `components/cms/cowork-deep-link.tsx`: if the protocol handler
 * doesn't take focus within 500ms (not installed), fall back to copying the
 * instruction to the clipboard so the user can paste it into Cowork.
 */
export function openCowork(instruction: string): void {
  if (typeof window === 'undefined') return
  let blurred = false
  const onBlur = () => {
    blurred = true
    window.removeEventListener('blur', onBlur)
  }
  window.addEventListener('blur', onBlur)
  window.open(`claude://cowork/new?q=${encodeURIComponent(instruction)}`, '_self')
  window.setTimeout(() => {
    window.removeEventListener('blur', onBlur)
    if (!blurred) {
      navigator.clipboard
        ?.writeText(instruction)
        .then(() => toast.success('Instrução copiada — cole no Cowork'))
        .catch(() => toast.error('Falha ao copiar instrução'))
    }
  }, 500)
}
