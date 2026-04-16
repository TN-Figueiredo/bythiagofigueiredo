# `@tn-figueiredo/*` Ecosystem Contract

## 1. Overview

The `@tn-figueiredo/*` scope is a private package ecosystem shared across projects owned by Thiago Figueiredo (`bythiagofigueiredo`, `tonagarantia`, future consumers). Packages are published to **GitHub Packages** (`https://npm.pkg.github.com`) under the **TN-Figueiredo** GitHub organization — chosen over public npmjs to keep solo-maintainer velocity, restrict access, and co-locate packages with their source repos.

## 2. Package registry + auth

### `.npmrc` template (consumer repo root)

```ini
@tn-figueiredo:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
save-exact=true
```

### Token provisioning

1. Go to https://github.com/settings/tokens → **"Generate new token (classic)"**.
2. Scope: `read:packages` (consumers) or `write:packages` (maintainer publishing).
3. Name it by consumer (`npm-read-<consumer>-YYYY-MM`). Set expiry ≤12 months.
4. Store the token in:
   - **GitHub Actions** → repo Settings → Secrets → `NPM_TOKEN`.
   - **Vercel** → project Settings → Environment Variables → `NPM_TOKEN` (all environments).
   - **Local dev** → export in shell rc (`export NPM_TOKEN=ghp_...`) so the `${NPM_TOKEN}` substitution in `.npmrc` resolves.

Never commit the token. `.npmrc` itself is safe to commit because the token is referenced via env var.

## 3. Versioning policy (semver)

| Phase | Rule |
|-------|------|
| Pre-1.0 (`0.x.y`) | Breaking changes allowed in **minor** (`0.x` bump). Consumers MUST pin exact. Patch = fix only. |
| Post-1.0 | Strict semver. Major = breaking, minor = additive & backward-compatible, patch = fix. |
| Deprecation | Mark exports `@deprecated` in TSDoc for **≥ 2 minor bumps** before removal. |
| LTS | None. Forward-only upgrades; oldest supported version = latest minus one major. |

## 4. Consumer pinning rule

Consumers MUST pin **exact** versions:

```json
"dependencies": {
  "@tn-figueiredo/shared": "0.8.0"
}
```

Never `^0.8.0` or `~0.8.0`. Enforced by the pre-commit hook (`scripts/ecosystem-pinning.sh`) and CI (`.github/workflows/ci.yml` → `ecosystem-pinning` job). Rationale: private registry + fast-moving 0.x releases; lockstep upgrades happen in focused PRs where the consumer reviews the diff explicitly.

## 5. Peer dependencies contract

Packages declare `peerDependencies` using **caret ranges** (standard npm practice — documented exception to the exact-pin rule, since peers describe a compatible range of the consumer's own framework deps).

Common peers:

| Peer | Range |
|------|-------|
| `react` | `^19` |
| `react-dom` | `^19` |
| `next` | `^15` |
| `@supabase/supabase-js` | `^2.103` |
| `fastify` | `^5` (api-side packages only) |

Consumers are responsible for satisfying peers. If a consumer lags a major, **the consumer bumps first**, then imports the new package version. Each package's CI matrix tests against `latest` and the pinned floor declared in its `peerDependencies`.

## 6. Package repo conventions

- **One package per repo**, named `TN-Figueiredo/<name>` (e.g. `TN-Figueiredo/cms`).
- Required files at repo root:
  - `LICENSE` — MIT, copyright "Thiago Figueiredo".
  - `CHANGELOG.md` — [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) format.
  - `README.md` — shaped for the **published** package consumer (install, import, API, peer deps, versioning note).
  - `.github/workflows/ci.yml` — typecheck, test, lint, build.
  - `.github/workflows/publish.yml` — tag-triggered publish (see §7).
  - `.github/dependabot.yml` — weekly npm + github-actions updates.

### `package.json` metadata floor

```json
{
  "name": "@tn-figueiredo/<name>",
  "version": "0.1.0",
  "license": "MIT",
  "author": "Thiago Figueiredo <tnfigueiredotv@gmail.com>",
  "homepage": "https://github.com/TN-Figueiredo/<name>#readme",
  "bugs": { "url": "https://github.com/TN-Figueiredo/<name>/issues" },
  "repository": { "type": "git", "url": "git+https://github.com/TN-Figueiredo/<name>.git" },
  "keywords": ["tn-figueiredo"],
  "engines": { "node": ">=20" },
  "sideEffects": false,
  "files": ["dist", "LICENSE", "README.md", "CHANGELOG.md"],
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "restricted"
  }
}
```

No `src/` in the published tarball — only compiled `dist/` + docs + license.

### Branch protection on `main`

- Require CI green before merge.
- No force-pushes.
- No branch deletions.
- Require linear history (rebase or squash merge).

## 7. Release flow

1. Update `CHANGELOG.md` under a new `## [X.Y.Z] - YYYY-MM-DD` heading.
2. Bump `package.json` version (`npm version <patch|minor|major> --no-git-tag-version`).
3. Commit: `chore(release): vX.Y.Z`.
4. Tag: `git tag vX.Y.Z && git push origin main --tags`.
5. `publish.yml` fires on tag push and validates:
   - **Idempotency** — skip if `npm view @tn-figueiredo/<name>@<version>` already exists.
   - **OIDC provenance** — `npm publish --provenance`.
   - **Size budget** — tarball `< 512 KB` (fail the job above threshold).
   - **Smoke test** — `test/consumer-smoke/` installs the packed tarball and typechecks a minimal import.
6. On success, a GitHub Release is created automatically with notes from the matching CHANGELOG section.

## 8. Consumer onboarding checklist

For a new consumer (e.g. `tonagarantia`):

- [ ] Add `.npmrc` with the scope + token var (see §2).
- [ ] Create a `read:packages` PAT and add as `NPM_TOKEN` in GH Secrets + Vercel env.
- [ ] Add dependency: `"@tn-figueiredo/<name>": "<EXACT_VERSION>"`.
- [ ] Run `npm install` — confirm resolution against GitHub Packages.
- [ ] If tempted to patch the package inside the consumer (e.g. via `patch-package`), **stop**: upstream the fix to the package repo and bump the version.
- [ ] Align peer deps (`next`, `react`, `@supabase/supabase-js`) with the package's declared ranges.
- [ ] Add the consumer to Appendix §12 ("Link map").

## 9. Rollback / incident response

| Window | Action |
|--------|--------|
| ≤ 72h after publish | Unpublish via GitHub Packages UI (repo → Packages → version → **Delete version**). CLI `npm unpublish` is not supported by GH Packages. |
| > 72h | Publish a fix (`0.x.y+1`) and delete the bad version via the same UI ("yank"). |
| Consumer-side | Pin the previous exact version in `package.json` → `npm install`. |

Open an issue in the affected package repo tagged `incident`, linking: bad version, symptom, fix version, consumer(s) impacted, ETA.

## 10. Deprecation policy

1. Mark the export with TSDoc `@deprecated <reason> — use <replacement> instead.`
2. Add a `### Deprecated` entry in the CHANGELOG for the release that introduces the deprecation.
3. Keep the deprecated export for **≥ 2 minor bumps** (pre-1.0) or **1 major** (post-1.0).
4. Remove in the announced release and add a `### Removed` entry.

## 11. Non-goals / out of scope

- Publishing to public npmjs.
- Automated breaking-change detection (may adopt `@microsoft/api-extractor` post-1.0).
- Automated migration codemods (handled ad-hoc per release in CHANGELOG `### Migration` section).
- Multi-maintainer governance (single-owner repo until a second maintainer joins).

## 12. Appendix: link map

| Package | Repo | Latest | Primary consumer |
|---------|------|--------|------------------|
| `@tn-figueiredo/shared` | https://github.com/TN-Figueiredo/shared | 0.8.0 | api, web |
| `@tn-figueiredo/auth` | https://github.com/TN-Figueiredo/auth | 1.3.0 | api |
| `@tn-figueiredo/auth-fastify` | https://github.com/TN-Figueiredo/auth-fastify | 1.1.0 | api |
| `@tn-figueiredo/auth-supabase` | https://github.com/TN-Figueiredo/auth-supabase | 1.1.0 | api |
| `@tn-figueiredo/auth-nextjs` | https://github.com/TN-Figueiredo/auth-nextjs | 2.0.0 | web |
| `@tn-figueiredo/audit` | https://github.com/TN-Figueiredo/audit | 0.1.0 | api |
| `@tn-figueiredo/lgpd` | https://github.com/TN-Figueiredo/lgpd | 0.1.0 | api |
| `@tn-figueiredo/admin` | https://github.com/TN-Figueiredo/admin | 0.3.0 | web |
| `@tn-figueiredo/cms` | https://github.com/TN-Figueiredo/cms | 0.1.0 (extracting) | web |
| `@tn-figueiredo/email` | https://github.com/TN-Figueiredo/email | 0.1.0 (extracting) | web, api |
| `@tn-figueiredo/notifications` | https://github.com/TN-Figueiredo/notifications | 0.1.0 | web |
| `@tn-figueiredo/seo` | https://github.com/TN-Figueiredo/seo | 0.1.0 | web |

> **Footnote — Confirm at kickoff.** The exact repo URLs, Node engines floor (`>=20`), tarball size budget (`512 KB`), and the "72h unpublish window" reflect GitHub Packages defaults as of 2026-04-15 and the solo-maintainer defaults chosen for this ecosystem. Re-confirm the unpublish window against GitHub's current docs before relying on it during an incident.
