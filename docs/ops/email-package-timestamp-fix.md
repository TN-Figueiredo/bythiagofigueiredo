# Fix plan: `@tn-figueiredo/email` SES webhook timestamps are all send-time

**Status:** planned (fix lives in the package repo, not here)
**Affected version pinned in this repo:** `@tn-figueiredo/email@0.2.0` (`apps/web/package.json`)
**Related doc:** `docs/ops/ses-sns-event-tracking.md`

## The bug

`SesWebhookProcessor.process()` normalizes **every** SES event's timestamp to
`event.mail.timestamp` — the **send** time — and ignores the event-specific
timestamps AWS includes in each notification.

Where to see it in the published artifact (readable in this repo):

- File: `node_modules/@tn-figueiredo/email/dist/webhooks.js`
- Symbol: `SesWebhookProcessor` → `process()` (~line 113):

  ```js
  const messageId = event.mail.messageId;
  const timestamp = event.mail.timestamp;   // ← used for ALL event types
  switch (event.eventType) {
    case "Delivery": return [{ messageId, type: "delivered", timestamp, ... }];
    case "Open":     return [{ messageId, type: "opened",    timestamp, ... }];
    case "Click":    return [{ messageId, type: "clicked",   timestamp, ... }];
    case "Bounce":   return [{ messageId, type: "bounced",   timestamp, ... }];
    case "Complaint":return [{ messageId, type: "complained",timestamp, ... }];
  }
  ```

- Source file in the **package repo** (per `dist/webhooks.js.map` `sources`):
  `src/webhooks/ses-processor.ts`

### Downstream impact in this repo

`apps/web/src/app/api/webhooks/ses/route.ts` writes
`delivered_at` / `opened_at` / `clicked_at` (and `link_clicks.clicked_at`)
straight from `event.timestamp`. Because the processor collapses everything to
send time:

- `opened_at` / `clicked_at` analytics ("when do readers open?") are meaningless
  — they always equal the send timestamp.
- Delivery latency (`delivered_at - sent_at`) is unmeasurable (always ~0).

## The exact change (in the package repo)

In `src/webhooks/ses-processor.ts`, replace the single shared `timestamp`
with the event-specific timestamp, falling back to `mail.timestamp` when the
event object/field is absent (AWS always sends it, but the processor must not
crash on partial payloads — `validateSesEvent` in `src/validation.ts` only
guarantees `eventType`, `mail.messageId`, `mail.timestamp`):

```ts
const messageId = event.mail.messageId
const sendTimestamp = event.mail.timestamp

switch (event.eventType) {
  case 'Delivery': {
    const timestamp = event.delivery?.timestamp ?? sendTimestamp
    return [{ messageId, type: 'delivered', timestamp, metadata: {} }]
  }
  case 'Open': {
    const timestamp = event.open?.timestamp ?? sendTimestamp
    return [{ messageId, type: 'opened', timestamp, metadata: { ip: event.open?.ipAddress, userAgent: event.open?.userAgent } }]
  }
  case 'Click': {
    const timestamp = event.click?.timestamp ?? sendTimestamp
    return [{ messageId, type: 'clicked', timestamp, metadata: { url: event.click?.link, ip: event.click?.ipAddress, userAgent: event.click?.userAgent } }]
  }
  case 'Bounce': {
    const timestamp = event.bounce?.timestamp ?? sendTimestamp
    return [{ messageId, type: 'bounced', timestamp, metadata: { bounceType: event.bounce?.bounceType === 'Permanent' ? 'hard' : 'soft' } }]
  }
  case 'Complaint': {
    // Same pattern — SES also ships complaint.timestamp.
    const timestamp = event.complaint?.timestamp ?? sendTimestamp
    return [{ messageId, type: 'complained', timestamp, metadata: {} }]
  }
  default:
    return []
}
```

Notes:

- If the package's `SesEvent` type doesn't declare `timestamp` on the
  `delivery`/`open`/`click`/`bounce`/`complaint` objects, add it as an
  **optional** `string` field (do NOT make it required in `validateSesEvent`
  — fallback handles absence, and rejecting otherwise-valid events would drop
  real notifications).
- No change needed in `validateSesEvent` itself.
- Add/extend package-side unit tests: each event type emits its own timestamp;
  each event type falls back to `mail.timestamp` when the field is missing.

## Release steps

1. **Package repo** (`@tn-figueiredo/email`):
   - Apply the change in `src/webhooks/ses-processor.ts` + tests.
   - Bump `version` in `package.json`: `0.2.0` → `0.3.0` (behavior change of
     emitted values — minor bump, no API signature change).
   - Build (`dist/` must be regenerated) and publish to GitHub Packages
     (`npm publish` with the repo's `.npmrc` → `npm.pkg.github.com`).
2. **This repo** (`bythiagofigueiredo`):
   - `apps/web/package.json`: `"@tn-figueiredo/email": "0.3.0"` —
     **exact version, no `^`** (repo policy; the pre-commit hook validates
     ecosystem pinning).
   - `npm install` (refreshes the lockfile + hoisted `node_modules`).
   - From `apps/web`: `npm run typecheck`.

## Test to un-skip after the upgrade

`apps/web/test/api/webhooks/ses-event-matrix.test.ts`:

- **Un-skip** (~line 400):
  `it.skip('Open → opened_at should be the OPEN time (open.timestamp), not the send time [known processor limitation]', ...)`
  → remove `.skip`. It asserts `opened_at === sesEvents.open.open.timestamp`
  (13:30 open vs 12:00 send) and will pass once the processor is fixed.
- **Flip the current-behavior pins** in the same file — these assert the OLD
  send-time normalization (`MAIL_TIMESTAMP`) and will start failing; update
  them to the event-specific fixture timestamps:
  - ~line 359/374: `Open → ... opened_at = mail.timestamp (NOT open.timestamp)`
    → expect `sesEvents.open.open.timestamp`.
  - ~line 420 (`opened_at`), ~445/462/481 (`clicked_at`),
    ~621/625 (out-of-order `opened_at`/`delivered_at`) → use the matching
    `open.timestamp` / `click.timestamp` / `delivery.timestamp` fixtures.
  - ~line 776 (Delivery event with **no** `delivery` object) keeps asserting
    `MAIL_TIMESTAMP` — it now pins the fallback path. Keep as-is.
- Run from `apps/web`:
  `npx vitest run test/api/webhooks/ses-event-matrix.test.ts`.
