# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-04-15

### Added

- First published release — initial extraction from the `bythiagofigueiredo` monorepo.
- `BrevoEmailAdapter` — transactional email adapter backed by the Brevo HTTP API.
- Template registry + built-in templates (`welcomeTemplate`, `inviteTemplate`, `confirmSubscriptionTemplate`, `contactReceivedTemplate`, `contactAdminAlertTemplate`) with pt-BR / en locales and per-site branding.
- Base layout helpers (`emailLayout`, `emailButton`, `formatDatePtBR`, `escapeHtml`).
- `ensureUnsubscribeToken` helper — sha256 hashed tokens with expiry, backed by Supabase.
- `p-queue` based concurrency control for outbound sends.
- `debug` namespace helpers exposed via `log.*` for adapter / templates / unsubscribe tracing.

[unreleased]: https://github.com/TN-Figueiredo/email/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/TN-Figueiredo/email/releases/tag/v0.1.0
