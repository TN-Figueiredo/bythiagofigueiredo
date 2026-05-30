import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * These tests verify the routing logic of the QR editor pages
 * by analyzing the source code structure. They validate:
 * - Legacy vs multi-card routing branches in page.tsx
 * - Client.tsx save logic branching on cardId
 * - Redirect behavior after card creation
 * - Auth enforcement patterns
 *
 * This approach is deterministic and needs no mocking -- it inspects
 * the actual source to confirm the routing contract is correct.
 */

const QR_DIR = resolve(__dirname, '../../../../src/app/cms/(authed)/links/[id]/qr')

function readFile(filename: string): string {
  return readFileSync(resolve(QR_DIR, filename), 'utf-8')
}

// ─── page.tsx routing ───────────────────────────────────────────────

describe('QR page routing (page.tsx)', () => {
  const page = readFile('page.tsx')

  it('extracts cardId from searchParams.card', () => {
    expect(page).toContain('sp.card')
    expect(page).toContain('cardId')
  })

  it('with ?card=<id>: calls loadQrCardById(cardId, id) with two args', () => {
    expect(page).toContain('loadQrCardById(cardId, id)')
  })

  it('with invalid card: calls notFound()', () => {
    expect(page).toContain('if (!loaded.ok) notFound()')
  })

  it('without card: falls back to legacy tracked_links data', () => {
    expect(page).toContain('link.qr_card_composition')
    expect(page).toContain('loadQrCard(id)')
  })

  it('supports legacy qr_config migration', () => {
    expect(page).toContain('migrateLegacyQrConfig')
    expect(page).toContain('link.qr_config')
  })

  it('passes cardId and cardName to the client component', () => {
    expect(page).toContain('cardId={cardId}')
    expect(page).toContain('cardName={cardName}')
  })

  it('defaults cardName to "Novo QR Card"', () => {
    expect(page).toContain("let cardName = 'Novo QR Card'")
  })

  it('routing has 3 branches: cardId, legacy composition, legacy config', () => {
    expect(page).toContain('if (cardId)')
    expect(page).toContain('else if (link.qr_card_composition)')
    expect(page).toContain('else if (link.qr_config)')
  })

  it('starts with a default composition (createDefaultComposition)', () => {
    expect(page).toContain('createDefaultComposition()')
  })

  it('if loadQrCardById succeeds but composition is null, keeps default', () => {
    expect(page).toContain('if (loaded.composition) composition = loaded.composition')
  })

  it('updates cardName from loaded card data', () => {
    expect(page).toContain('cardName = loaded.name')
  })

  it('requires edit scope and redirects to /cms if denied', () => {
    expect(page).toContain("requireSiteScope({ area: 'cms', siteId, mode: 'edit' })")
    expect(page).toContain("if (!authRes.ok) redirect('/cms')")
  })

  it('filters link by site_id for tenant isolation', () => {
    expect(page).toContain(".eq('site_id', siteId)")
  })

  it('calls notFound() when link does not exist', () => {
    expect(page).toContain('if (error || !link) notFound()')
  })

  it('is a server component (force-dynamic)', () => {
    expect(page).toContain("export const dynamic = 'force-dynamic'")
    expect(page).not.toContain("'use client'")
  })
})

// ─── client.tsx save logic ──────────────────────────────────────────

describe('QR client save logic (client.tsx)', () => {
  const client = readFile('client.tsx')

  it('with cardId: calls updateQrCard', () => {
    expect(client).toContain('updateQrCard(cardId, link.id, { composition })')
  })

  it('without cardId: calls createQrCard to create new card', () => {
    expect(client).toContain('createQrCard(link.id, cardName, composition)')
  })

  it('redirects after creating new card with window.location.href', () => {
    expect(client).toContain('window.location.href = `/cms/links/${link.id}/qr?card=${result.cardId}`')
  })

  it('legacy dual-write has been removed (no saveQrCard in handleSave)', () => {
    // After refactoring, saveQrCard was removed from the client.
    // Only createQrCard and updateQrCard are used.
    const handleSaveBody = client.slice(
      client.indexOf('const handleSave'),
      client.indexOf('const handleExport'),
    )
    expect(handleSaveBody).not.toContain('saveQrCard')
  })

  it('imports card-actions for multi-card operations', () => {
    expect(client).toContain("from './card-actions'")
    expect(client).toContain('createQrCard')
    expect(client).toContain('updateQrCard')
  })

  it('imports actions.ts for template and export operations', () => {
    expect(client).toContain("from './actions'")
    expect(client).toContain('saveQrTemplate')
    expect(client).toContain('deleteQrTemplate')
    expect(client).toContain('exportQrCard')
    expect(client).toContain('uploadQrImage')
  })

  it('handleSave uses cardId to decide create vs update', () => {
    expect(client).toContain('if (cardId)')
  })

  it('handleSave returns after redirect (no further code runs on create path)', () => {
    const handleSaveBody = client.slice(
      client.indexOf('const handleSave'),
      client.indexOf('const handleExport'),
    )
    expect(handleSaveBody).toContain('return')
  })

  it('logs errors on save failure', () => {
    expect(client).toContain("console.error('[QR Card] updateQrCard failed:'")
    expect(client).toContain("console.error('[QR Card] createQrCard failed:'")
  })

  it('is a client component', () => {
    expect(client).toContain("'use client'")
  })

  it('delegates rendering to QrCardBuilder from links-admin', () => {
    expect(client).toContain("from '@tn-figueiredo/links-admin/client'")
    expect(client).toContain('<QrCardBuilder')
  })

  it('passes onSave, onExport, onSaveTemplate, onDeleteTemplate, onImageUpload to builder', () => {
    expect(client).toContain('onSave={handleSave}')
    expect(client).toContain('onExport={handleExport}')
    expect(client).toContain('onSaveTemplate={handleSaveTemplate}')
    expect(client).toContain('onDeleteTemplate={handleDeleteTemplate}')
    expect(client).toContain('onImageUpload={handleImageUpload}')
  })

  it('handleExport calls exportQrCard with FormData', () => {
    expect(client).toContain('exportQrCard(link.id, fd)')
  })

  it('handleImageUpload calls uploadQrImage', () => {
    expect(client).toContain('uploadQrImage(fd)')
  })

  it('handleImageUpload returns empty string on failure', () => {
    const uploadBlock = client.slice(
      client.indexOf('const handleImageUpload'),
      client.indexOf('return ('),
    )
    expect(uploadBlock).toContain("return result.ok ? result.url : ''")
  })
})

// ─── card-actions.ts exports and structure ──────────────────────────

describe('QR card-actions exports (card-actions.ts)', () => {
  const cardActions = readFile('card-actions.ts')

  it('exports listQrCards', () => {
    expect(cardActions).toContain('export async function listQrCards')
  })

  it('exports createQrCard', () => {
    expect(cardActions).toContain('export async function createQrCard')
  })

  it('exports updateQrCard', () => {
    expect(cardActions).toContain('export async function updateQrCard')
  })

  it('exports deleteQrCard', () => {
    expect(cardActions).toContain('export async function deleteQrCard')
  })

  it('exports loadQrCardById', () => {
    expect(cardActions).toContain('export async function loadQrCardById')
  })

  it('is a server action file', () => {
    expect(cardActions).toContain("'use server'")
  })

  it('listQrCards filters by link_id and site_id', () => {
    expect(cardActions).toContain(".eq('link_id', linkId)")
    expect(cardActions).toContain(".eq('site_id', siteId)")
  })

  it('createQrCard inserts with link_id, site_id, name and composition', () => {
    expect(cardActions).toContain('link_id: linkId')
    expect(cardActions).toContain('site_id: siteId')
    expect(cardActions).toContain('name: nameParsed.data')
    expect(cardActions).toContain('composition: parsed.data')
  })

  it('createQrCard verifies link ownership via tracked_links lookup', () => {
    const createBlock = cardActions.slice(
      cardActions.indexOf('export async function createQrCard'),
      cardActions.indexOf('export async function updateQrCard'),
    )
    expect(createBlock).toContain("from('tracked_links')")
    expect(createBlock).toContain("is('deleted_at', null)")
    expect(createBlock).toContain("'link_not_found'")
  })

  it('deleteQrCard filters by id, link_id and site_id (tenant isolation)', () => {
    const deleteBlock = cardActions.slice(
      cardActions.indexOf('export async function deleteQrCard'),
      cardActions.indexOf('export async function loadQrCardById'),
    )
    expect(deleteBlock).toContain(".eq('id', cardId)")
    expect(deleteBlock).toContain(".eq('link_id', linkId)")
    expect(deleteBlock).toContain(".eq('site_id', siteId)")
  })

  it('loadQrCardById filters by id, link_id and site_id', () => {
    const loadBlock = cardActions.slice(
      cardActions.indexOf('export async function loadQrCardById'),
    )
    expect(loadBlock).toContain(".eq('id', cardId)")
    expect(loadBlock).toContain(".eq('link_id', linkId)")
    expect(loadBlock).toContain(".eq('site_id', siteId)")
  })

  it('write functions use requireEditScope', () => {
    for (const fn of ['createQrCard', 'updateQrCard', 'deleteQrCard']) {
      const fnIndex = cardActions.indexOf(`export async function ${fn}`)
      const nextExportIndex = cardActions.indexOf('export async function', fnIndex + 1)
      const fnBody = nextExportIndex > -1
        ? cardActions.slice(fnIndex, nextExportIndex)
        : cardActions.slice(fnIndex, fnIndex + 500)
      expect(fnBody).toContain('requireEditScope(siteId)')
    }
  })

  it('read functions use requireReadScope (not requireEditScope)', () => {
    for (const fn of ['listQrCards', 'loadQrCardById']) {
      const fnIndex = cardActions.indexOf(`export async function ${fn}`)
      const nextExportIndex = cardActions.indexOf('export async function', fnIndex + 1)
      const fnBody = nextExportIndex > -1
        ? cardActions.slice(fnIndex, nextExportIndex)
        : cardActions.slice(fnIndex, fnIndex + 500)
      expect(fnBody).toContain('requireReadScope(siteId)')
      expect(fnBody).not.toContain('requireEditScope(siteId)')
    }
  })

  it('uses sanitizeBlobUrls before persisting', () => {
    expect(cardActions).toContain('sanitizeBlobUrls')
    expect(cardActions).toContain("from './shared'")
  })

  it('exports QrCardSummary interface with correct fields', () => {
    expect(cardActions).toContain('export interface QrCardSummary')
    expect(cardActions).toContain('id: string')
    expect(cardActions).toContain('name: string')
    expect(cardActions).toContain('previewUrl: string | null')
    expect(cardActions).toContain('createdAt: string')
  })

  it('listQrCards orders by sort_order then created_at', () => {
    expect(cardActions).toContain("order('sort_order'")
    expect(cardActions).toContain("order('created_at'")
  })

  it('NameSchema enforces min 1 and max 200 with trim', () => {
    expect(cardActions).toContain('z.string().min(1).max(200).trim()')
  })
})
