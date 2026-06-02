import { useCallback, type KeyboardEvent } from 'react'

/**
 * Returns an onKeyDown handler that triggers click on Enter/Space.
 * Use on non-button interactive elements with role="button" + tabIndex={0}.
 *
 * Enter: triggers click immediately.
 * Space: preventDefault (prevents scroll) then triggers click.
 */
export function useClickKeyHandler() {
  return useCallback((e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.click()
    } else if (e.key === ' ') {
      e.preventDefault()
      e.currentTarget.click()
    }
  }, [])
}
