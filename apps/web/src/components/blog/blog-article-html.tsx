'use client'

import DOMPurify from 'isomorphic-dompurify'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EmbedHydrator } from './embed-hydrator'
import { WaitlistEmbedInPost } from '@/components/waitlists/waitlist-embed-in-post'

interface BlogArticleHtmlProps {
  html: string
}

interface WaitlistTarget {
  el: HTMLElement
  slug: string
}

export function BlogArticleHtml({ html }: BlogArticleHtmlProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [waitlistTargets, setWaitlistTargets] = useState<WaitlistTarget[]>([])

  useEffect(() => {
    if (!bodyRef.current) return
    const hydrator = new EmbedHydrator(bodyRef.current)
    hydrator.hydrate()

    // Waitlist placeholders (compile-json `renderWaitlistEmbed`) become React portals —
    // <WaitlistEmbedInPost> mounts the real signup form (state resolved by mount-GET).
    const targets: WaitlistTarget[] = []
    bodyRef.current
      .querySelectorAll<HTMLElement>('.pb-waitlist[data-slug]')
      .forEach((el) => {
        const slug = el.dataset.slug ?? ''
        if (slug) targets.push({ el, slug })
      })
    setWaitlistTargets(targets)

    return () => {
      hydrator.cleanup()
      setWaitlistTargets([])
    }
  }, [html])

  // Article locale — the blog page renders <article lang={locale}> around this body.
  const articleLang = bodyRef.current?.closest('[lang]')?.getAttribute('lang') ?? undefined

  return (
    <>
      <div ref={bodyRef} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
      {waitlistTargets.map(({ el, slug }, i) =>
        createPortal(<WaitlistEmbedInPost slug={slug} locale={articleLang} />, el, `${slug}-${i}`),
      )}
    </>
  )
}
