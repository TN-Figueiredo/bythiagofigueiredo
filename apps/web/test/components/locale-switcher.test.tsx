import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { LocaleSwitcher } from '../../src/components/locale-switcher'

describe('LocaleSwitcher', () => {
  it('returns null when only one locale is available', () => {
    const { container } = render(
      <LocaleSwitcher available={['pt-BR']} current="pt-BR" hrefFor={(l) => `/x/${l}`} />
    )
    expect(container.querySelector('[data-testid="locale-switcher"]')).toBeNull()
  })

  it('returns null when available is empty', () => {
    const { container } = render(
      <LocaleSwitcher available={[]} current="pt-BR" hrefFor={(l) => `/x/${l}`} />
    )
    expect(container.querySelector('[data-testid="locale-switcher"]')).toBeNull()
  })

  it('renders links for non-current locales and a span for the current one', () => {
    const { container } = render(
      <LocaleSwitcher
        available={['pt-BR', 'en']}
        current="pt-BR"
        hrefFor={(l) => `/blog/${l}/hello`}
      />
    )
    const switcher = container.querySelector('[data-testid="locale-switcher"]')
    expect(switcher).toBeTruthy()
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]!.getAttribute('href')).toBe('/blog/en/hello')
    expect(links[0]!.getAttribute('hreflang')).toBe('en')
    const current = container.querySelector('[aria-current="true"]')
    expect(current?.textContent).toBe('pt-BR')
  })

  it('uses the hrefFor mapper for each locale', () => {
    const hrefFor = (l: string) => (l === 'en' ? '/blog/en/greeting' : `/blog/${l}/ola`)
    const { container } = render(
      <LocaleSwitcher available={['pt-BR', 'en']} current="en" hrefFor={hrefFor} />
    )
    const links = Array.from(container.querySelectorAll('a'))
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/blog/pt-BR/ola'])
  })
})
