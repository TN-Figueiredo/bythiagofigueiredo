import { NextResponse } from 'next/server'
import { WORKFLOWS } from '@/lib/pipeline/workflows'

export async function GET() {
  return NextResponse.json({
    name: 'Content Pipeline API',
    version: '1.0.0',
    auth: {
      methods: ['api_key', 'session_cookie'],
      header: 'X-Pipeline-Key',
      rate_limit: '100/min (api_key only)',
    },
    endpoints: [
      { method: 'GET', path: '/api/pipeline/context', description: 'Get all reference content' },
      { method: 'GET', path: '/api/pipeline/context/:key', description: 'Get specific reference doc' },
      { method: 'PUT', path: '/api/pipeline/context/:key', description: 'Upsert reference doc' },
      { method: 'DELETE', path: '/api/pipeline/context/:key', description: 'Delete reference doc' },
      { method: 'GET', path: '/api/pipeline/collections', description: 'List collections' },
      { method: 'GET', path: '/api/pipeline/collections/:id', description: 'Get collection with members' },
      { method: 'POST', path: '/api/pipeline/collections', description: 'Create collection' },
      { method: 'PUT', path: '/api/pipeline/collections/:id', description: 'Update collection' },
      { method: 'DELETE', path: '/api/pipeline/collections/:id', description: 'Delete collection' },
      { method: 'GET', path: '/api/pipeline/items', description: 'List items (cursor pagination)' },
      { method: 'GET', path: '/api/pipeline/items/:id', description: 'Get item detail' },
      { method: 'POST', path: '/api/pipeline/items', description: 'Create item(s)' },
      { method: 'PATCH', path: '/api/pipeline/items/:id', description: 'Update item (If-Match required)' },
      { method: 'DELETE', path: '/api/pipeline/items/:id', description: 'Archive item' },
      { method: 'POST', path: '/api/pipeline/items/:id/advance', description: 'Advance to next stage' },
      { method: 'POST', path: '/api/pipeline/items/:id/retreat', description: 'Retreat to previous stage' },
      { method: 'POST', path: '/api/pipeline/items/:id/checklist', description: 'Toggle checklist item' },
      { method: 'POST', path: '/api/pipeline/items/:id/graduate', description: 'Graduate to entity' },
      { method: 'POST', path: '/api/pipeline/items/:id/restore', description: 'Restore archived item' },
      { method: 'GET', path: '/api/pipeline/items/:id/history', description: 'Get item audit trail' },
      { method: 'POST', path: '/api/pipeline/items/bulk', description: 'Batch operations' },
      { method: 'GET', path: '/api/pipeline/collections/:id/members', description: 'List collection members' },
      { method: 'POST', path: '/api/pipeline/collections/:id/members', description: 'Add members to collection' },
      { method: 'DELETE', path: '/api/pipeline/collections/:id/members', description: 'Remove member from collection' },
      { method: 'GET', path: '/api/pipeline/workflows', description: 'Get all workflow definitions' },
      { method: 'GET', path: '/api/pipeline/search', description: 'Cross-entity search' },
      { method: 'GET', path: '/api/pipeline/stats', description: 'Pipeline statistics' },
      { method: 'GET', path: '/api/pipeline/topics/:code', description: 'Topic aggregation' },
    ],
    formats: Object.keys(WORKFLOWS),
    workflows: WORKFLOWS,
  })
}
