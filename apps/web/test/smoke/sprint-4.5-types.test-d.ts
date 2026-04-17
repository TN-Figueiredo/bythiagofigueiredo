// @vitest-environment node — type-only file; no runtime assertions needed.
//
// Bi-directional structural equivalence — catches admin/cms inlined-type drift
// from auth-nextjs canonical. Scope is intentionally narrow to AuthStrings and
// AuthTheme (which DO match across all three packages today). ActionResult and
// AuthPageProps have KNOWN drift that will be resolved in follow-ups:
//   - tn-cms: Phase 4 T10e flips inline types to auth-nextjs imports
//   - admin: a future 0.5.1 patch aligns inlined ActionResult with canonical
//     generic discriminated union
// When those land, extend this test to cover ActionResult + AuthPageProps.
import type { AuthTheme as Canonical, AuthStrings as CanonicalStrings } from '@tn-figueiredo/auth-nextjs/actions'
import type { AuthTheme as AdminTheme, AuthStrings as AdminStrings } from '@tn-figueiredo/admin/login'
import type { AuthTheme as CmsTheme, AuthStrings as CmsStrings } from '@tn-figueiredo/cms/login'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false

const _assertThemeAdmin: Equal<AdminTheme, Canonical> = true
const _assertThemeCms: Equal<CmsTheme, Canonical> = true
const _assertStringsAdmin: Equal<AdminStrings, CanonicalStrings> = true
const _assertStringsCms: Equal<CmsStrings, CanonicalStrings> = true
