# @tn-figueiredo/email

Transactional email package for the TN-Figueiredo conglomerate. Brevo adapter, template registry, i18n, unsubscribe token helper.

## Install

```bash
npm install @tn-figueiredo/email --save-exact
```

## Usage

```ts
import { BrevoEmailAdapter, welcomeTemplate } from '@tn-figueiredo/email'

const email = new BrevoEmailAdapter(process.env.BREVO_API_KEY!)
await email.sendTemplate(welcomeTemplate, sender, 'user@example.com', {
  brandName: 'My Site', siteUrl: 'https://...', unsubscribeUrl: '...',
}, 'pt-BR')
```

## Architecture

Decoupled from marketing list management (use existing `lib/brevo.ts createBrevoContact` for that). This package handles **transactional** emails: 1 recipient, template + variables, optional reply-to.

Templates accept locale (pt-BR or en) and per-site branding. Helpers manage unsubscribe tokens stored in `unsubscribe_tokens` table.

## License

Internal.
