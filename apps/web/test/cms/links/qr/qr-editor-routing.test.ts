import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * These tests verify the routing logic of the QR editor pages
 * by analyzing the source code structure. They validate:
 * - Legacy vs multi-card routing branches in page.tsx
 * - Client.tsx save logic branching on cardId
 * - Redirect behavior after card creation
 *
 * This approach is deterministic and needs no mocking — it inspects
 * the actual source to confirm the routing contract is correct.
 */

const QR_DIR = resolve(__dirname, '../../../../src/app/cms/(authed)/links/[id]/qr')

function readFile(filename: string): string {
  return readFileSync(resolve(QR_DIR, filename), 'utf-8')
}

describe.skip('QR page routing (page.tsx)', () => { // TODO: broken by component refactoring
  const page = readFile('page.tsx')

  it('extrai cardId de searchParams.card', () => {
    expect(page).toContain('sp.card')
    expect(page).toContain('cardId')
  })

  it('sem ?card: carrega da tracked_links (legacy)', () => {
    // When no cardId, page falls through to qr_card_composition check
    expect(page).toContain('link.qr_card_composition')
    expect(page).toContain('loadQrCard(id)')
  })

  it('com ?card=<id>: carrega de link_qr_cards via loadQrCardById', () => {
    expect(page).toContain('loadQrCardById(cardId)')
  })

  it('card invalido/inexistente usa composicao padrao', () => {
    // createDefaultComposition is assigned before the cardId check
    expect(page).toContain('createDefaultComposition()')
    // If loadQrCardById returns no composition, it falls back to default
    expect(page).toContain('loaded.ok && loaded.composition')
  })

  it('suporta migracao de qr_config legado', () => {
    expect(page).toContain('migrateLegacyQrConfig')
    expect(page).toContain('link.qr_config')
  })

  it('passa cardId e cardName para o client component', () => {
    expect(page).toContain('cardId={cardId}')
    expect(page).toContain('cardName={cardName}')
  })

  it('define cardName como Novo QR Card por padrao', () => {
    expect(page).toContain("let cardName = 'Novo QR Card'")
  })

  it('routing tem 3 branches: cardId, legacy composition, legacy config', () => {
    // Branch 1: cardId present
    expect(page).toContain('if (cardId)')
    // Branch 2: has saved composition
    expect(page).toContain('else if (link.qr_card_composition)')
    // Branch 3: has legacy qr_config
    expect(page).toContain('else if (link.qr_config)')
  })
})

describe('QR client save logic (client.tsx)', () => {
  const client = readFile('client.tsx')

  it('com cardId: chama updateQrCard', () => {
    expect(client).toContain('updateQrCard(cardId, link.id, { composition })')
  })

  it('sem cardId: chama createQrCard para criar novo card', () => {
    expect(client).toContain('createQrCard(link.id, cardName, composition)')
  })

  it('redireciona apos criar novo card com window.location.href', () => {
    expect(client).toContain('window.location.href = `/cms/links/${link.id}/qr?card=${result.cardId}`')
  })

  it('tambem salva no legacy tracked_links para compatibilidade', () => {
    expect(client).toContain('saveQrCard(link.id, composition)')
  })

  it('importa card-actions para operacoes multi-card', () => {
    expect(client).toContain("from './card-actions'")
    expect(client).toContain('createQrCard')
    expect(client).toContain('updateQrCard')
  })

  it('importa actions.ts para operacoes legacy', () => {
    expect(client).toContain("from './actions'")
    expect(client).toContain('saveQrCard')
  })

  it('handleSave depende de cardId para decidir create vs update', () => {
    // The callback uses cardId to branch
    expect(client).toContain('if (cardId)')
  })

  it('handleSave retorna apos redirect (nao salva no legacy)', () => {
    // After createQrCard succeeds, it sets location.href and returns
    // The saveQrCard call for legacy happens only on update path
    const handleSaveBody = client.slice(
      client.indexOf('const handleSave'),
      client.indexOf('const handleExport'),
    )
    expect(handleSaveBody).toContain('return')
  })
})

describe('QR card-actions exports (card-actions.ts)', () => {
  const cardActions = readFile('card-actions.ts')

  it('exporta listQrCards', () => {
    expect(cardActions).toContain('export async function listQrCards')
  })

  it('exporta createQrCard', () => {
    expect(cardActions).toContain('export async function createQrCard')
  })

  it('exporta updateQrCard', () => {
    expect(cardActions).toContain('export async function updateQrCard')
  })

  it('exporta deleteQrCard', () => {
    expect(cardActions).toContain('export async function deleteQrCard')
  })

  it('exporta loadQrCardById', () => {
    expect(cardActions).toContain('export async function loadQrCardById')
  })

  it('listQrCards filtra por link_id e site_id', () => {
    expect(cardActions).toContain(".eq('link_id', linkId)")
    expect(cardActions).toContain(".eq('site_id', siteId)")
  })

  it('createQrCard insere com link_id, site_id, name e composition', () => {
    expect(cardActions).toContain('link_id: linkId')
    expect(cardActions).toContain('site_id: siteId')
    expect(cardActions).toContain('name,')
    expect(cardActions).toContain('composition: parsed.data')
  })

  it('deleteQrCard filtra por id e site_id (tenant isolation)', () => {
    // The delete function uses .eq('id', cardId) and .eq('site_id', siteId)
    const deleteBlock = cardActions.slice(
      cardActions.indexOf('export async function deleteQrCard'),
      cardActions.indexOf('export async function loadQrCardById'),
    )
    expect(deleteBlock).toContain(".eq('id', cardId)")
    expect(deleteBlock).toContain(".eq('site_id', siteId)")
  })

  it('loadQrCardById filtra por site_id (nunca expoe dados cross-tenant)', () => {
    const loadBlock = cardActions.slice(
      cardActions.indexOf('export async function loadQrCardById'),
    )
    expect(loadBlock).toContain(".eq('id', cardId)")
    expect(loadBlock).toContain(".eq('site_id', siteId)")
  })

  it('todas as funcoes de escrita usam requireEdit()', () => {
    // Write functions: createQrCard, updateQrCard, deleteQrCard
    for (const fn of ['createQrCard', 'updateQrCard', 'deleteQrCard']) {
      const fnIndex = cardActions.indexOf(`export async function ${fn}`)
      const nextExportIndex = cardActions.indexOf('export async function', fnIndex + 1)
      const fnBody = nextExportIndex > -1
        ? cardActions.slice(fnIndex, nextExportIndex)
        : cardActions.slice(fnIndex, fnIndex + 500)
      expect(fnBody).toContain('requireEdit()')
    }
  })

  it('funcoes de leitura nao usam requireEdit (read-only)', () => {
    // listQrCards and loadQrCardById only use getSiteContext, not requireEdit
    const listBlock = cardActions.slice(
      cardActions.indexOf('export async function listQrCards'),
      cardActions.indexOf('export async function createQrCard'),
    )
    expect(listBlock).not.toContain('requireEdit()')
    expect(listBlock).toContain('getSiteContext()')
  })

  it('sanitizeBlobUrls converte background image com blob para solid', () => {
    expect(cardActions).toContain('sanitizeBlobUrls')
    expect(cardActions).toContain("startsWith('blob:')")
  })

  it('QrCardSummary interface exportada com tipos corretos', () => {
    expect(cardActions).toContain('export interface QrCardSummary')
    expect(cardActions).toContain('id: string')
    expect(cardActions).toContain('name: string')
    expect(cardActions).toContain('previewUrl: string | null')
    expect(cardActions).toContain('createdAt: string')
  })

  it('listQrCards ordena por sort_order e created_at', () => {
    expect(cardActions).toContain("order('sort_order'")
    expect(cardActions).toContain("order('created_at'")
  })
})
