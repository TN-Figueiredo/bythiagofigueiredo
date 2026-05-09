import { NextResponse } from 'next/server'
import { WORKFLOWS, DEFAULT_CHECKLISTS } from '@/lib/pipeline/workflows'

export async function GET() {
  return NextResponse.json({ data: { workflows: WORKFLOWS, default_checklists: DEFAULT_CHECKLISTS } })
}
