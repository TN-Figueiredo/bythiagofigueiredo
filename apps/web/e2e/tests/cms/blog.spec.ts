import { test, expect } from '../../fixtures'
import { BlogEditorPage } from '../../pages/BlogEditorPage'
import { seedBlogPost } from '../../fixtures/seed-helpers'
import AxeBuilder from '@axe-core/playwright'

test.describe('CMS / Blog', () => {
  test.use({ storageState: 'e2e/.auth/editor.json' })
  test.describe.configure({ mode: 'serial' })

  test.afterAll(async ({ supabaseAdmin, testId }) => {
    const { data: translations } = await supabaseAdmin
      .from('blog_translations')
      .select('post_id')
      .like('slug', `test-${testId}-%`)
    const { data: uiCreated } = await supabaseAdmin
      .from('blog_translations')
      .select('post_id')
      .like('title', `%${testId}%`)
    const allPostIds = new Set([
      ...(translations ?? []).map((t: { post_id: string }) => t.post_id),
      ...(uiCreated ?? []).map((t: { post_id: string }) => t.post_id),
    ])
    if (allPostIds.size > 0) {
      await supabaseAdmin.from('blog_posts').delete().in('id', [...allPostIds])
    }
  })

  test('lista de posts carrega', async ({ page, acceptedCookies }) => {
    await page.goto('/cms/blog')
    await expect(page.getByRole('table')).toBeVisible()
  })

  test('criar draft', async ({ page, acceptedCookies, testId }) => {
    await page.goto('/cms/blog/new')
    await expect(page.getByTestId('cms-blog-title-input').or(page.getByLabel(/[Tt]ítulo|[Tt]itle/))).toBeVisible()
    const editor = new BlogEditorPage(page)
    await editor.fillTitle(`Test Draft ${testId}`)
    await editor.saveDraft()
    await page.goto('/cms/blog')
    await expect(page.getByText(`Test Draft ${testId}`)).toBeVisible()
  })

  test('publicar post e verificar URL pública', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const postId = await seedBlogPost(supabaseAdmin, siteId, editorUserId, {
      title: 'Test Publish Post', slug: `test-${testId}-publish`,
    })

    await page.goto(`/cms/blog/${postId}/edit`)
    await expect(page.getByTestId('cms-blog-title-input').or(page.getByLabel(/[Tt]ítulo|[Tt]itle/))).toBeVisible()
    await new BlogEditorPage(page).publish()

    const publicPage = await page.context().newPage()
    await publicPage.goto(`/pt/blog/test-${testId}-publish`)
    await expect(publicPage).not.toHaveURL(/404/)
    await publicPage.close()

    const { data: updated } = await supabaseAdmin
      .from('blog_posts')
      .select('status, published_at')
      .eq('id', postId)
      .single()
    expect(updated?.status).toBe('published')
    expect(updated?.published_at).not.toBeNull()
  })

  test('despublicar torna URL pública inacessível', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const postId = await seedBlogPost(supabaseAdmin, siteId, editorUserId, {
      title: 'Test Unpublish Post', slug: `test-${testId}-unpublish`,
    }, { status: 'published', published_at: new Date().toISOString() })

    await page.goto(`/cms/blog/${postId}/edit`)
    await expect(page.getByTestId('cms-blog-title-input').or(page.getByLabel(/[Tt]ítulo|[Tt]itle/))).toBeVisible()
    await new BlogEditorPage(page).unpublish()

    const publicPage = await page.context().newPage()
    const response = await publicPage.goto(`/pt/blog/test-${testId}-unpublish`)
    expect(response?.status()).toBe(404)
    await publicPage.close()
  })

  test('editar draft persiste após reload', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const postId = await seedBlogPost(supabaseAdmin, siteId, editorUserId, {
      title: 'Test Edit Post', slug: `test-${testId}-edit`,
    })

    await page.goto(`/cms/blog/${postId}/edit`)
    await expect(page.getByTestId('cms-blog-title-input').or(page.getByLabel(/[Tt]ítulo|[Tt]itle/))).toBeVisible()
    const editor = new BlogEditorPage(page)
    await editor.fillTitle('Test Blog Edited Title')
    await editor.saveDraft()

    await page.reload()
    await expect(page.getByRole('textbox', { name: /^(Título|Title)$/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /^(Título|Title)$/i })).toHaveValue('Test Blog Edited Title')
  })

  test('arquivar post', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const postId = await seedBlogPost(supabaseAdmin, siteId, editorUserId, {
      title: 'Test Archive Post', slug: `test-${testId}-archive`,
    })

    await page.goto(`/cms/blog/${postId}/edit`)
    await expect(page.getByTestId('cms-blog-title-input').or(page.getByLabel(/[Tt]ítulo|[Tt]itle/))).toBeVisible()
    await new BlogEditorPage(page).archive()

    const { data: archived } = await supabaseAdmin
      .from('blog_posts')
      .select('status')
      .eq('id', postId)
      .single()
    expect(archived?.status).toBe('archived')
  })

  test('deletar post remove da lista', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const postId = await seedBlogPost(supabaseAdmin, siteId, editorUserId, {
      title: 'Test Delete Post', slug: `test-${testId}-delete`,
    })

    await page.goto(`/cms/blog/${postId}/edit`)
    await expect(page.getByTestId('cms-blog-title-input').or(page.getByLabel(/[Tt]ítulo|[Tt]itle/))).toBeVisible()
    await new BlogEditorPage(page).delete()
    await expect(page).toHaveURL(/\/cms\/blog/, { timeout: 10_000 })
    await expect(page.getByText(`test-${testId}-delete`)).not.toBeVisible()

    const { data: deleted } = await supabaseAdmin
      .from('blog_posts')
      .select('id')
      .eq('id', postId)
      .maybeSingle()
    expect(deleted).toBeNull()
  })

  test.fixme('locale switching — cria tradução en de post pt-BR', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const postId = await seedBlogPost(supabaseAdmin, siteId, editorUserId, {
      title: 'Test PT', slug: `test-${testId}-locale-pt`,
    })
    await supabaseAdmin.from('blog_translations').insert({
      post_id: postId, locale: 'en', slug: `test-${testId}-locale-en`, title: 'Test EN', content_mdx: '# EN',
    })

    await page.goto(`/cms/blog/${postId}/edit`)
    const editor = new BlogEditorPage(page)
    await editor.switchLocale('en')
    await expect(page.getByTestId('cms-blog-locale-selector')).toHaveAttribute('data-locale', 'en')
  })

  test('agendar publicação', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
    const postId = await seedBlogPost(supabaseAdmin, siteId, editorUserId, {
      title: 'Test Schedule Post', slug: `test-${testId}-schedule`,
    })

    await page.goto(`/cms/blog/${postId}/edit`)
    await expect(page.getByTestId('cms-blog-title-input').or(page.getByLabel(/[Tt]ítulo|[Tt]itle/))).toBeVisible()
    const futureDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16)
    await new BlogEditorPage(page).schedule(futureDate)

    const { data: scheduled } = await supabaseAdmin
      .from('blog_posts')
      .select('status, scheduled_at')
      .eq('id', postId)
      .single()
    expect(scheduled?.status).toBe('scheduled')
    expect(scheduled?.scheduled_at).not.toBeNull()
  })

  test.describe('reporter — restrições de publicação', () => {
    test.use({ storageState: 'e2e/.auth/reporter.json' })

    test('reporter não consegue publicar post', async ({ page, acceptedCookies, supabaseAdmin, siteId, editorUserId, testId }) => {
      const postId = await seedBlogPost(supabaseAdmin, siteId, editorUserId, {
        title: 'Test Reporter Pub Post', slug: `test-${testId}-reporter-pub`,
      })

      await page.goto(`/cms/blog/${postId}/edit`)
      await expect(page.getByTestId('cms-blog-title-input').or(page.getByLabel(/[Tt]ítulo|[Tt]itle/))).toBeVisible()
      await new BlogEditorPage(page).expectPublishBlocked()
    })
  })

  test.describe('a11y', () => {
    test('sem violations críticas em /cms/blog/new', async ({ page, acceptedCookies }) => {
      await page.goto('/cms/blog/new')
      await expect(page.getByTestId('cms-blog-title-input').or(page.getByLabel(/[Tt]ítulo|[Tt]itle/))).toBeVisible()
      const results = await new AxeBuilder({ page }).analyze()
      const critical = results.violations.filter(
        v => v.impact === 'critical' || v.impact === 'serious'
      )
      expect(
        critical,
        critical.map(v => `${v.id}: ${v.description}`).join('\n')
      ).toHaveLength(0)
    })
  })
})
