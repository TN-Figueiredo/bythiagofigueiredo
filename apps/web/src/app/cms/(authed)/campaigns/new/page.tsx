import { redirect } from 'next/navigation'
import { createCampaign } from './actions'
import { getSiteContext } from '@/lib/cms/site-context'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function NewCampaignPage({ searchParams }: Props) {
  const sp = await searchParams
  const ctx = await getSiteContext()

  async function submit(formData: FormData) {
    'use server'
    const slug = String(formData.get('slug') ?? '').trim()
    const interest = String(formData.get('interest') ?? '').trim()
    const locale = String(formData.get('locale') ?? '').trim()
    const title = String(formData.get('title') ?? '').trim()
    const mainHook = String(formData.get('main_hook_md') ?? '').trim()

    if (!slug || !interest || !locale || !title || !mainHook) {
      redirect('/cms/campaigns/new?error=missing_fields')
    }

    const result = await createCampaign({
      slug,
      interest,
      locale,
      title,
      main_hook_md: mainHook,
    })
    if (!result.ok) {
      redirect(`/cms/campaigns/new?error=${encodeURIComponent(result.error)}`)
    }
    redirect(`/cms/campaigns/${result.campaignId}/edit`)
  }

  return (
    <main>
      <header>
        <h1>Nova campanha</h1>
      </header>
      {sp.error && (
        <p role="alert" className="text-sm text-[var(--cms-red,#ef4444)]">
          Erro: {sp.error}
        </p>
      )}
      <form action={submit}>
        <label>
          Slug
          <input name="slug" type="text" required />
        </label>
        <label>
          Interesse (interest key)
          <input name="interest" type="text" required />
        </label>
        <label>
          Locale principal
          <select name="locale" defaultValue={ctx.defaultLocale}>
            <option value="pt-BR">pt-BR</option>
            <option value="en">en</option>
          </select>
        </label>
        <label>
          Meta title
          <input name="title" type="text" required />
        </label>
        <label>
          Hook principal (markdown)
          <textarea name="main_hook_md" rows={3} required />
        </label>
        <button type="submit">Criar</button>
      </form>
    </main>
  )
}
