# @tn-figueiredo/email

Brevo-backed transactional email adapter with templates and unsubscribe tokens — part of the `@tn-figueiredo/*` ecosystem.

## Install

The package lives on GitHub Packages. Configure `.npmrc` at your repo root:

```ini
@tn-figueiredo:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

Then install with an exact version (ecosystem policy — no `^`):

```bash
npm install @tn-figueiredo/email@0.1.0 --save-exact
```

## Peer dependencies

| Peer | Version |
|------|---------|
| `@supabase/supabase-js` | `^2.103.0` |

Supabase is only required if you use `ensureUnsubscribeToken`.

## Exports

- `BrevoEmailAdapter` — transactional sender (Brevo HTTP API, with `p-queue` concurrency control).
- `TemplateRegistry` and built-ins: `welcomeTemplate`, `inviteTemplate`, `confirmSubscriptionTemplate`, `contactReceivedTemplate`, `contactAdminAlertTemplate`.
- Layout helpers: `emailLayout`, `emailButton`, `formatDatePtBR`, `escapeHtml`.
- `ensureUnsubscribeToken` — sha256 hashed tokens with expiry.
- `log` — `debug` namespaces (`tn-figueiredo:email:adapter|templates|unsubscribe`).
- Types: `IEmailService`, `IEmailTemplate`, `EmailMessage`, `Branding`.

## Usage

```ts
import { BrevoEmailAdapter, welcomeTemplate } from '@tn-figueiredo/email'

const email = new BrevoEmailAdapter(process.env.BREVO_API_KEY!)

await email.sendTemplate(
  welcomeTemplate,
  { email: 'hello@site.com', name: 'Site' },
  'user@example.com',
  { brandName: 'My Site', siteUrl: 'https://site.com', unsubscribeUrl: 'https://site.com/u?t=...' },
  'pt-BR',
)
```

Enable debug tracing with `DEBUG=tn-figueiredo:email:*`.

## Environment

| Var | Purpose |
|-----|---------|
| `BREVO_API_KEY` | API key for Brevo (required to construct `BrevoEmailAdapter`). |

## Architecture

Decoupled from marketing list management — handles **transactional** emails only: one recipient, template + variables, optional reply-to. Templates accept a locale (`pt-BR` or `en`) and per-site branding. Unsubscribe helpers expect an `unsubscribe_tokens` table in Supabase.

## Versioning

Follows [Semantic Versioning](https://semver.org/). The `@tn-figueiredo/*` ecosystem pins exact versions — see the monorepo `docs/ecosystem.md` for the upgrade policy.

## License

MIT © 2026 Thiago Figueiredo
