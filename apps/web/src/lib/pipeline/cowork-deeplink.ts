/**
 * Open Claude (Cowork) with a pre-written instruction.
 *
 * The `claude://cowork/new` protocol handler opens a FRESH Cowork task but does NOT
 * reliably prefill the prompt from a query param — so we ALWAYS copy the instruction
 * to the clipboard (we're inside the click gesture, so this is allowed) and the
 * caller tells the user to paste it (⌘V). The clipboard is the source of truth; the
 * deep link just brings the app to the front on a new task. Returns whether the copy
 * was initiated so the caller can tailor its toast.
 */
export function openCowork(instruction: string): boolean {
  if (typeof window === 'undefined') return false
  let copied = false
  try {
    void navigator.clipboard?.writeText(instruction).catch(() => {})
    copied = !!navigator.clipboard
  } catch {
    copied = false
  }
  // `?q=` is kept as a best-effort prefill for any Claude version that honors it
  // (harmless when ignored); the new-task route is what actually opens.
  window.open(`claude://cowork/new?q=${encodeURIComponent(instruction)}`, '_self')
  return copied
}
