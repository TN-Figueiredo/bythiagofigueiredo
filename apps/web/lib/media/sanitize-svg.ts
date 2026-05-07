import DOMPurify from 'isomorphic-dompurify'

export function sanitizeSvg(svgString: string): string {
  return DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ['use'],
    FORBID_TAGS: ['script', 'foreignObject', 'set', 'animate'],
    FORBID_ATTR: ['onload', 'onerror', 'onclick', 'onmouseover'],
  })
}
