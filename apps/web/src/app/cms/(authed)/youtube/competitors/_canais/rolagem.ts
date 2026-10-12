/** A casca do CMS rola dentro de `main`, não na janela: quem observa ou rola a lista começa pelo contêiner que rola de verdade. */
export function contentorQueRola(el: Element | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if (o === 'auto' || o === 'scroll') return p
  }
  return null
}

/** Rolagem suave só para quem não pediu menos movimento. */
export function comportamentoDeRolagem(): ScrollBehavior {
  try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' } catch { return 'auto' }
}
