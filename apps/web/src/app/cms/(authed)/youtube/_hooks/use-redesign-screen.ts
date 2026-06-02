/**
 * Feature flag helper for gradual YouTube CMS redesign rollout.
 *
 * Reads `YT_REDESIGN_SCREENS` env var:
 *  - undefined → all screens use new design (default on)
 *  - ''        → all screens use old design (kill switch)
 *  - 'competitors,ab-lab' → only listed screens use new design
 */
export function useRedesignScreen(screen: string): boolean {
  const flag = process.env.YT_REDESIGN_SCREENS
  if (flag === undefined) return true // default: all on
  if (flag === '') return false
  return flag.split(',').map(s => s.trim()).includes(screen)
}
