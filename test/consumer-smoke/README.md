# consumer-smoke

In-repo fixture that validates the packed tarball works end-to-end in a real Next.js 15 consumer **before** publishing to GitHub Packages.

## Purpose

Catches regressions that only surface post-pack:

- Missing files in `files` field of `package.json`
- Broken `exports` map (subpath imports, `./code` etc.)
- TypeScript declarations not emitted or wrong path
- Peer-dep resolution errors under real npm install
- `"type": "module"` / ESM vs CJS mismatches
- Accidental Node-only imports leaking into client bundles

## How it runs in CI

The `test` job in `.github/workflows/ci.yml` does, after `npm run build`:

1. `npm pack` in repo root → produces `<pkg>-<version>.tgz`
2. `cd test/consumer-smoke && npm install ../../*.tgz --no-save`
3. `npm install` (pulls Next + React)
4. `npm run build` — `next build` must exit 0

If any step fails, CI blocks the PR / blocks the tag push from reaching publish.

## Running locally

From the extracted repo root:

```bash
npm run build
npm pack
cd test/consumer-smoke
npm install ../*.tgz --no-save
npm install
npm run build
```

A convenience script `npm run smoke` should be added to the extracted repo's root `package.json` during Phase 2 setup — wire it up to orchestrate the steps above.

## Customization per-package

Each extracted repo (`TN-Figueiredo/cms`, `TN-Figueiredo/email`) edits `app/page.tsx` to import a representative export from its package — enough to exercise the build pipeline end-to-end.
