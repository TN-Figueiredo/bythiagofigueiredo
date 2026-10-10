# Workspace Package Build Confidence

Movido do `CLAUDE.md` em 2026-10-09.

Automated pipeline that guarantees zero CI failures from stale workspace packages. All gates are automatic — no manual checklist.

### How it works

| Gate | When | What it checks | Cost |
|------|------|----------------|------|
| `postinstall` | `npm ci`/`npm install` | Builds workspace packages | +5-8s |
| Pre-commit | Every commit | build:packages → typecheck web → typecheck api (sem testes nem `next build` desde 2026-06-06) | ~40-60s |
| Post-merge | After `git pull` | Auto-rebuilds if `packages/*/src/` changed | +5-8s |
| Pre-push | Every push | Full ecosystem: rebuild + pinning + imports + typecheck | +45-60s |

### Single source of truth

`npm run build:packages` — defined once in root `package.json`, consumed by all gates and CI. Adding a new package = edit this one line.

### Package categories

- **Need build (dist/ export):** `@tn-figueiredo/links`, `@tn-figueiredo/social` — must be in `build:packages`
- **No build (src/ export):** `@tn-figueiredo/links-admin` — in `transpilePackages`. In `build:packages` for consistency.
- **Exception:** `@app/shared` (`packages/shared`) — raw TS, `transpilePackages`, NodeNext incompatible with workspace build
- **Published:** All other `@tn-figueiredo/*` — from GitHub Packages, pinned exact versions

### Decision tree

- **Created new workspace package with dist/ export?** → Add to `build:packages` in root package.json. Test blocks commit if you forget.
- **Modified workspace package source?** → Nothing manual. Pre-commit auto-rebuilds.
- **After git pull and something broken?** → Run `npm run build:packages`. Post-merge should have done this.
- **CI typecheck fails on @tn-figueiredo/* types?** → Verify package is in `build:packages`.
- **Import works locally but not CI?** → Declare it in consuming app's package.json.

