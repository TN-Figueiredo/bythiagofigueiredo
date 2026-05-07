import { describe, it, expect } from 'vitest'
import {
  detectProvider,
  extractYouTubeId,
  extractTweetId,
  extractInstagramCode,
  extractCodeSandboxId,
  extractCodePenPath,
  extractGistId,
  getEmbedSrc,
  PROVIDER_META,
  escapeHtmlAttr,
  GIST_SRC_RE,
} from '../../src/app/cms/(authed)/_shared/editor/social-embed-node'

describe('detectProvider', () => {
  it('detects youtube.com watch URLs', () => {
    expect(detectProvider('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
  })

  it('detects youtu.be short URLs', () => {
    expect(detectProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
  })

  it('detects twitter.com URLs', () => {
    expect(detectProvider('https://twitter.com/elonmusk/status/1234567890')).toBe('twitter')
  })

  it('detects x.com URLs', () => {
    expect(detectProvider('https://x.com/user/status/9876543210')).toBe('twitter')
  })

  it('detects instagram post URLs', () => {
    expect(detectProvider('https://www.instagram.com/p/ABC123/')).toBe('instagram')
  })

  it('detects instagram reel URLs', () => {
    expect(detectProvider('https://instagram.com/reel/XYZ789/')).toBe('instagram')
  })

  it('detects instagram tv URLs', () => {
    expect(detectProvider('https://instagram.com/tv/ABC123/')).toBe('instagram')
  })

  it('detects codesandbox /s/ URLs', () => {
    expect(detectProvider('https://codesandbox.io/s/my-sandbox')).toBe('codesandbox')
  })

  it('detects codesandbox /p/sandbox/ URLs', () => {
    expect(detectProvider('https://codesandbox.io/p/sandbox/cool-project')).toBe('codesandbox')
  })

  it('detects codesandbox /p/devbox/ URLs', () => {
    expect(detectProvider('https://codesandbox.io/p/devbox/thing')).toBe('codesandbox')
  })

  it('detects codepen URLs', () => {
    expect(detectProvider('https://codepen.io/johndoe/pen/AbCdEf')).toBe('codepen')
  })

  it('detects github gist URLs', () => {
    expect(detectProvider('https://gist.github.com/octocat/abc123def456')).toBe('github')
  })

  it('returns null for unrecognized URLs', () => {
    expect(detectProvider('https://example.com')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(detectProvider('')).toBeNull()
  })

  it('returns null for plain text', () => {
    expect(detectProvider('hello world')).toBeNull()
  })
})

describe('extractYouTubeId', () => {
  it('extracts id from watch URL', () => {
    expect(extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id from embed URL', () => {
    expect(extractYouTubeId('https://youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id from shorts URL', () => {
    expect(extractYouTubeId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id from youtu.be short URL', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts id with extra query params', () => {
    expect(extractYouTubeId('https://youtube.com/watch?v=dQw4w9WgXcQ&t=30')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for channel URL', () => {
    expect(extractYouTubeId('https://youtube.com/@user')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractYouTubeId('')).toBeNull()
  })
})

describe('extractTweetId', () => {
  it('extracts id from twitter.com status URL', () => {
    expect(extractTweetId('https://twitter.com/elonmusk/status/1234567890')).toBe('1234567890')
  })

  it('extracts id from x.com status URL', () => {
    expect(extractTweetId('https://x.com/user/status/999')).toBe('999')
  })

  it('extracts id with query params', () => {
    expect(extractTweetId('https://twitter.com/user/status/111?s=20')).toBe('111')
  })

  it('returns null for non-status twitter URL', () => {
    expect(extractTweetId('https://twitter.com/user/likes')).toBeNull()
  })

  it('returns null for random string', () => {
    expect(extractTweetId('not a url')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractTweetId('')).toBeNull()
  })
})

describe('extractInstagramCode', () => {
  it('extracts shortcode from /p/ URL', () => {
    expect(extractInstagramCode('https://www.instagram.com/p/CxYz123_Ab/')).toBe('CxYz123_Ab')
  })

  it('extracts shortcode from /reel/ URL', () => {
    expect(extractInstagramCode('https://instagram.com/reel/ABC-def/')).toBe('ABC-def')
  })

  it('handles URL without trailing slash', () => {
    expect(extractInstagramCode('https://instagram.com/p/ABC123')).toBe('ABC123')
  })

  it('extracts shortcode from /tv/ URL', () => {
    expect(extractInstagramCode('https://instagram.com/tv/DEF456/')).toBe('DEF456')
  })

  it('returns null for profile URL', () => {
    expect(extractInstagramCode('https://instagram.com/user')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractInstagramCode('')).toBeNull()
  })
})

describe('extractCodeSandboxId', () => {
  it('extracts id from /s/ URL', () => {
    expect(extractCodeSandboxId('https://codesandbox.io/s/my-sandbox-abc123')).toBe('my-sandbox-abc123')
  })

  it('extracts id from /p/sandbox/ URL', () => {
    expect(extractCodeSandboxId('https://codesandbox.io/p/sandbox/cool-project')).toBe('cool-project')
  })

  it('extracts id from /p/devbox/ URL', () => {
    expect(extractCodeSandboxId('https://codesandbox.io/p/devbox/thing')).toBe('thing')
  })

  it('returns null for root codesandbox URL', () => {
    expect(extractCodeSandboxId('https://codesandbox.io/')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractCodeSandboxId('')).toBeNull()
  })
})

describe('extractCodePenPath', () => {
  it('extracts path from /pen/ URL', () => {
    expect(extractCodePenPath('https://codepen.io/johndoe/pen/AbCdEf')).toBe('johndoe/embed/AbCdEf')
  })

  it('extracts path from /full/ URL', () => {
    expect(extractCodePenPath('https://codepen.io/user/full/XyZ123')).toBe('user/embed/XyZ123')
  })

  it('extracts path from /details/ URL', () => {
    expect(extractCodePenPath('https://codepen.io/user/details/ABC')).toBe('user/embed/ABC')
  })

  it('returns null for profile URL', () => {
    expect(extractCodePenPath('https://codepen.io/user')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractCodePenPath('')).toBeNull()
  })
})

describe('extractGistId', () => {
  it('extracts user/id from gist URL', () => {
    expect(extractGistId('https://gist.github.com/octocat/abc123def456')).toBe('octocat/abc123def456')
  })

  it('extracts long hex gist id', () => {
    expect(extractGistId('https://gist.github.com/user/abcdef0123456789')).toBe('user/abcdef0123456789')
  })

  it('returns null for regular github URL', () => {
    expect(extractGistId('https://github.com/user/repo')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractGistId('')).toBeNull()
  })
})

describe('getEmbedSrc', () => {
  it('returns youtube embed URL', () => {
    const src = getEmbedSrc('youtube', 'https://youtube.com/watch?v=dQw4w9WgXcQ')
    expect(src).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
  })

  it('returns twitter embed URL', () => {
    const src = getEmbedSrc('twitter', 'https://x.com/user/status/123')
    expect(src).toContain('platform.twitter.com')
    expect(src).toContain('id=123')
    expect(src).toContain('theme=dark')
  })

  it('returns instagram embed URL', () => {
    const src = getEmbedSrc('instagram', 'https://instagram.com/p/ABC/')
    expect(src).toBe('https://www.instagram.com/p/ABC/embed/')
  })

  it('returns codesandbox embed URL', () => {
    const src = getEmbedSrc('codesandbox', 'https://codesandbox.io/s/cool')
    expect(src).toContain('codesandbox.io/embed/cool')
    expect(src).toContain('theme=dark')
  })

  it('returns codepen embed URL', () => {
    const src = getEmbedSrc('codepen', 'https://codepen.io/user/pen/ABC')
    expect(src).toContain('codepen.io/user/embed/ABC')
    expect(src).toContain('theme-id=dark')
  })

  it('returns github gist .js URL', () => {
    const src = getEmbedSrc('github', 'https://gist.github.com/user/abc123')
    expect(src).toBe('https://gist.github.com/user/abc123.js')
  })

  it('returns null for twitter with invalid URL', () => {
    expect(getEmbedSrc('twitter', 'https://twitter.com/user/likes')).toBeNull()
  })

  it('returns null for instagram with invalid URL', () => {
    expect(getEmbedSrc('instagram', 'https://instagram.com/user')).toBeNull()
  })

  it('returns null for codesandbox with invalid URL', () => {
    expect(getEmbedSrc('codesandbox', 'https://example.com')).toBeNull()
  })

  it('returns null for codepen with invalid URL', () => {
    expect(getEmbedSrc('codepen', 'garbage')).toBeNull()
  })

  it('returns null for github with invalid URL', () => {
    expect(getEmbedSrc('github', 'https://github.com/user/repo')).toBeNull()
  })

  it('returns null for youtube with invalid URL', () => {
    expect(getEmbedSrc('youtube', 'https://youtube.com/@channel')).toBeNull()
  })
})

describe('PROVIDER_META', () => {
  it('has entries for all six providers', () => {
    expect(Object.keys(PROVIDER_META)).toEqual(
      expect.arrayContaining(['youtube', 'twitter', 'instagram', 'codesandbox', 'codepen', 'github']),
    )
  })

  it('each entry has label, color, and placeholder', () => {
    for (const meta of Object.values(PROVIDER_META)) {
      expect(meta).toHaveProperty('label')
      expect(meta).toHaveProperty('color')
      expect(meta).toHaveProperty('placeholder')
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.color).toMatch(/^#/)
      expect(meta.placeholder).toMatch(/^https:\/\//)
    }
  })
})

describe('security: URL extraction does not produce unsafe output', () => {
  it('codepen rejects path traversal in user segment', () => {
    expect(extractCodePenPath('https://codepen.io/../../../etc/pen/passwd')).toBeNull()
  })

  it('gist rejects non-hex gist ids', () => {
    expect(extractGistId('https://gist.github.com/user/<script>alert(1)</script>')).toBeNull()
  })

  it('tweet id only captures digits even if trailing chars exist', () => {
    const result = extractTweetId('https://twitter.com/user/status/123abc')
    expect(result).toBe('123')
    expect(result).toMatch(/^\d+$/)
  })

  it('youtube rejects IDs that are not exactly 11 chars', () => {
    expect(extractYouTubeId('https://youtube.com/watch?v=short')).toBeNull()
  })

  it('gist only accepts hex characters in gist id', () => {
    expect(extractGistId('https://gist.github.com/user/GHIJ1234')).toBeNull()
  })

  it('youtube extractor captures safe ID even from non-http URL (ID is safe chars only)', () => {
    const id = extractYouTubeId('javascript:youtube.com/watch?v=dQw4w9WgXcQ')
    expect(id).toBe('dQw4w9WgXcQ')
    expect(id).toMatch(/^[A-Za-z0-9_-]{11}$/)
  })

  it('instagram rejects /stories/ URLs', () => {
    expect(extractInstagramCode('https://instagram.com/stories/user/123')).toBeNull()
  })
})

describe('escapeHtmlAttr', () => {
  it('escapes angle brackets', () => {
    expect(escapeHtmlAttr('<script>')).toBe('&lt;script&gt;')
  })

  it('escapes ampersands', () => {
    expect(escapeHtmlAttr('a&b')).toBe('a&amp;b')
  })

  it('escapes quotes', () => {
    expect(escapeHtmlAttr('"hello"')).toBe('&quot;hello&quot;')
  })

  it('escapes single quotes', () => {
    expect(escapeHtmlAttr("it's")).toBe("it&#39;s")
  })

  it('passes through safe strings unchanged', () => {
    expect(escapeHtmlAttr('https://gist.github.com/user/abc123.js')).toBe('https://gist.github.com/user/abc123.js')
  })
})

describe('GIST_SRC_RE', () => {
  it('matches valid gist .js URLs', () => {
    expect(GIST_SRC_RE.test('https://gist.github.com/octocat/abc123def456.js')).toBe(true)
  })

  it('rejects URLs without .js suffix', () => {
    expect(GIST_SRC_RE.test('https://gist.github.com/octocat/abc123')).toBe(false)
  })

  it('rejects non-hex gist ids', () => {
    expect(GIST_SRC_RE.test('https://gist.github.com/user/GHIJ.js')).toBe(false)
  })

  it('rejects javascript: protocol', () => {
    expect(GIST_SRC_RE.test('javascript:alert(1)//gist.github.com/u/abc.js')).toBe(false)
  })

  it('rejects XSS in path segments', () => {
    expect(GIST_SRC_RE.test('https://gist.github.com/"><script>/abc.js')).toBe(false)
  })
})

describe('extractInstagramCode — /tv/ support', () => {
  it('extracts shortcode from /tv/ URL', () => {
    expect(extractInstagramCode('https://www.instagram.com/tv/CxYz123_Ab/')).toBe('CxYz123_Ab')
  })

  it('detects provider for /tv/ URL', () => {
    expect(detectProvider('https://instagram.com/tv/ABC123/')).toBe('instagram')
  })
})
