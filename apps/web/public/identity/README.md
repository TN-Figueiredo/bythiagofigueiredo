# identity/ — Person/Organization assets for JSON-LD

Static image assets referenced by `apps/web/lib/seo/identity-profiles.ts` and
served as JSON-LD `Person.image` / `Organization.logo` rich-result fields.

## Expected files

### `thiago.jpg` (placeholder until real photo lands)

- **Format**: JPEG (`image/jpeg`)
- **Aspect**: 1:1 (square)
- **Dimensions**: ≥ 400×400 px (Google rich-result minimum is 112×112; larger
  is better for high-DPI rendering on social previews)
- **Size**: < 100 KB (tune via `mozjpeg` / `jpegoptim` or use WebP fallback at
  the CDN layer)
- **Public URL contract**: `https://bythiagofigueiredo.com/identity/thiago.jpg`
- **Used by**: `IDENTITY_PROFILES.bythiagofigueiredo.imageUrl` →
  `Person.image` in `lib/seo/json-ld/person.ts`

### Until the real file is committed

JSON-LD will still emit the URL above and Google's parser will not error,
but the rich-result preview shows a broken-image icon. This is a degraded
state, not a breaking one. Replace with the production photo when ready.

## Adding a new identity (organization)

For an org profile, add `<orgslug>-logo.png` (1:1, ≥ 240×240, transparent
background) and update `IDENTITY_PROFILES` to point at
`/identity/<orgslug>-logo.png`.

## Why this directory is committed empty

Sprint 5b PR-B ships the wiring (identity-profiles registry + JSON-LD
builders + page metadata) before the real photo is available. The
`.gitkeep` reserves the path so the contract is stable; the photo lands
in a follow-up commit (see Sprint 5b plan task B.23).
