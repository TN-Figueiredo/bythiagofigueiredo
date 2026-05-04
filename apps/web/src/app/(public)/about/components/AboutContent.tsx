import { MdxRunner, compileMdx } from '@tn-figueiredo/cms'
import { blogRegistry } from '@/lib/cms/registry'

interface AboutContentProps {
  subtitle: string | null
  aboutCompiled: string | null
  aboutMd: string | null
}

export async function AboutContent({ subtitle, aboutCompiled, aboutMd }: AboutContentProps) {
  let compiledSource = aboutCompiled
  if (!compiledSource && aboutMd) {
    const result = await compileMdx(aboutMd, blogRegistry)
    compiledSource = result.compiledSource
  }

  return (
    <div className="about-content">
      {subtitle && <p className="about-tagline">{subtitle}</p>}
      {compiledSource && (
        <div className="about-chapters">
          <MdxRunner compiledSource={compiledSource} registry={blogRegistry} />
        </div>
      )}
    </div>
  )
}
