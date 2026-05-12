const EMBED_HEIGHTS: Record<string, number> = {
  youtube: 400, twitter: 350, instagram: 480, codesandbox: 500,
  codepen: 400, github: 320, vimeo: 400, loom: 400, spotify: 152,
  soundcloud: 166, figma: 450,
}

function getEmbedUrl(provider: string, url: string): string | null {
  switch (provider) {
    case 'youtube': {
      const match = url.match(/(?:v=|\/embed\/|youtu\.be\/)([^&?/]+)/)
      return match ? `https://www.youtube.com/embed/${match[1]}` : null
    }
    case 'vimeo': {
      const match = url.match(/vimeo\.com\/(\d+)/)
      return match ? `https://player.vimeo.com/video/${match[1]}` : null
    }
    case 'loom': {
      const match = url.match(/loom\.com\/share\/([a-f0-9]+)/)
      return match ? `https://www.loom.com/embed/${match[1]}` : null
    }
    case 'spotify':
      return url.replace('open.spotify.com/', 'open.spotify.com/embed/')
    case 'soundcloud':
      return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false`
    case 'codepen':
      return url.replace('/pen/', '/embed/') + '?default-tab=result&theme-id=dark'
    case 'codesandbox': {
      const match = url.match(/codesandbox\.io\/s\/([^?/]+)/)
      return match ? `https://codesandbox.io/embed/${match[1]}?fontsize=14&theme=dark` : null
    }
    case 'figma':
      return `https://www.figma.com/embed?embed_host=astra&url=${encodeURIComponent(url)}`
    default:
      return null
  }
}

export class EmbedHydrator {
  private container: HTMLElement
  private iframes: HTMLIFrameElement[] = []

  constructor(container: HTMLElement) {
    this.container = container
  }

  hydrate() {
    const embeds = this.container.querySelectorAll<HTMLElement>('.pb-embed[data-provider][data-url]')
    embeds.forEach((el) => {
      const provider = el.dataset.provider ?? ''
      const url = el.dataset.url ?? ''
      if (!url) return

      const embedUrl = getEmbedUrl(provider, url)
      if (!embedUrl) {
        const link = document.createElement('a')
        link.href = url
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.style.color = 'var(--pb-accent)'
        link.textContent = url
        el.replaceChildren(link)
        return
      }

      const iframe = document.createElement('iframe')
      iframe.src = embedUrl
      iframe.style.width = '100%'
      iframe.style.height = `${EMBED_HEIGHTS[provider] ?? 400}px`
      iframe.style.border = '0'
      iframe.loading = 'lazy'
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups')
      iframe.allowFullscreen = true

      el.innerHTML = ''
      el.appendChild(iframe)
      this.iframes.push(iframe)
    })
  }

  cleanup() {
    this.iframes.forEach((iframe) => iframe.remove())
    this.iframes = []
  }
}
