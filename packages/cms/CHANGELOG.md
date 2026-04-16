# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0-beta.1] - 2026-04-15

### Added

- First published release; initial extraction from the `bythiagofigueiredo` monorepo.
- `PostEditor` React component with toolbar, live preview, asset picker, and autosave hook.
- `SupabasePostRepository`, `SupabaseContentRepository`, `SupabaseCampaignRepository` — Supabase-backed repository implementations.
- `SupabaseRingContext` — multi-ring / multi-site host resolution against `sites.domains`.
- MDX pipeline: `compileMdx()` (compile-on-save), `MdxRunner` (render-time `run()`), `extractToc()`, `calculateReadingTime()`, `defaultComponents`.
- i18n editor strings for pt-BR (default) and en, extensible via `getEditorStrings(locale)`.
- Opt-in shiki code block via `@tn-figueiredo/cms/code` subpath export.
- Campaign editor components (`CampaignEditor`, `CampaignMetaForm`, `CampaignTranslationForm`) and landing-page markdown renderer.
- `uploadContentAsset()` helper for Supabase Storage uploads.
- `debug` namespaced loggers exported as `log` (`tn-figueiredo:cms:editor|repo|mdx|ring`).

### Notes

- Requires Next.js `transpilePackages: ['@tn-figueiredo/cms']` in consumer (see README §Next.js configuration). This is part of the v0.1.x contract.

[unreleased]: https://github.com/TN-Figueiredo/cms/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/TN-Figueiredo/cms/releases/tag/v0.1.0-beta.1
