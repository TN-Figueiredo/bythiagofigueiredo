// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import React from 'react'
import { PipelineDeadlineDigest, type DeadlineItem } from '../../src/emails/pipeline-deadline-digest'

const OVERDUE: DeadlineItem = {
  title: 'Video atrasado',
  stage: 'roteiro',
  format: 'video',
  deadlineDate: '2026-05-24',
  pubDate: '2026-05-28',
  daysUntilDeadline: -2,
}

const DUE_TOMORROW: DeadlineItem = {
  title: 'Blog post amanha',
  stage: 'draft',
  format: 'blog_post',
  deadlineDate: '2026-05-27',
  pubDate: '2026-05-31',
  daysUntilDeadline: 1,
}

const DUE_IN_3: DeadlineItem = {
  title: 'Newsletter em breve',
  stage: 'draft',
  format: 'newsletter',
  deadlineDate: '2026-05-29',
  pubDate: '2026-06-02',
  daysUntilDeadline: 3,
}

describe('PipelineDeadlineDigest', () => {
  it('renders overdue section when overdue items exist', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="pt-BR"
        items={[OVERDUE]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('Video atrasado')
    expect(html).toContain('Atrasado')
  })

  it('renders due-tomorrow section', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="pt-BR"
        items={[DUE_TOMORROW]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('Blog post amanha')
  })

  it('renders upcoming section for items due in 3 days', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="pt-BR"
        items={[DUE_IN_3]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('Newsletter em breve')
  })

  it('renders all three sections together', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="pt-BR"
        items={[OVERDUE, DUE_TOMORROW, DUE_IN_3]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('Video atrasado')
    expect(html).toContain('Blog post amanha')
    expect(html).toContain('Newsletter em breve')
  })

  it('renders English copy when locale is en', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="en"
        items={[OVERDUE]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('Overdue')
  })

  it('includes dashboard link', async () => {
    const html = await render(
      <PipelineDeadlineDigest
        locale="pt-BR"
        items={[OVERDUE]}
        dashboardUrl="https://bythiagofigueiredo.com/cms/pipeline"
      />
    )
    expect(html).toContain('https://bythiagofigueiredo.com/cms/pipeline')
  })
})
