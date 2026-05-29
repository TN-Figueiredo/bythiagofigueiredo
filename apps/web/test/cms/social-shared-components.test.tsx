import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SocialBreadcrumb } from '@/app/cms/(authed)/social/_components/shared/social-breadcrumb'
import { SocialPageHeader } from '@/app/cms/(authed)/social/_components/shared/social-page-header'

describe('SocialBreadcrumb', () => {
  it('renders crumbs with separators', () => {
    render(<SocialBreadcrumb crumbs={[
      { label: 'Social', href: '/cms/social' },
      { label: 'Feed' },
    ]} />)
    expect(screen.getByText('Social')).toBeTruthy()
    expect(screen.getByText('Feed')).toBeTruthy()
    expect(screen.getByText('/')).toBeTruthy()
  })

  it('renders link for crumbs with href', () => {
    render(<SocialBreadcrumb crumbs={[
      { label: 'Social', href: '/cms/social' },
      { label: 'Feed' },
    ]} />)
    const link = screen.getByText('Social').closest('a')
    expect(link?.getAttribute('href')).toBe('/cms/social')
  })
})

describe('SocialPageHeader', () => {
  it('renders title and subtitle', () => {
    render(
      <SocialPageHeader
        breadcrumb={<span>breadcrumb</span>}
        title="Social Studio"
        subtitle="Manage posts"
      />
    )
    expect(screen.getByText('Social Studio')).toBeTruthy()
    expect(screen.getByText('Manage posts')).toBeTruthy()
  })

  it('renders actions when provided', () => {
    render(
      <SocialPageHeader
        breadcrumb={<span>breadcrumb</span>}
        title="Test"
        actions={<button>New Post</button>}
      />
    )
    expect(screen.getByText('New Post')).toBeTruthy()
  })
})
