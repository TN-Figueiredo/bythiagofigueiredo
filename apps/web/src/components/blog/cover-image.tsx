import Image from 'next/image'
import { Tape } from '@/app/(public)/components/Tape'
import { HeroIllustration } from './hero-illustration'

type Props = {
  src: string | null
  alt: string
  heroIllustration?: string | null
  dark?: boolean
  accent?: string
}

export function CoverImage({ src, alt, heroIllustration, dark, accent }: Props) {
  if (!src && !heroIllustration) return null

  if (heroIllustration) {
    return (
      <div className="mb-10">
        <div
          className="rounded overflow-hidden"
          style={{
            maxWidth: 920,
            margin: '0 auto',
            aspectRatio: '16/9',
            background: dark
              ? 'linear-gradient(135deg, #2A241A 0%, #14110B 100%)'
              : 'linear-gradient(135deg, #FBF6E8 0%, #E9E1CE 100%)',
          }}
        >
          <HeroIllustration kind={heroIllustration} dark={dark ?? false} accent={accent ?? '#C14513'} />
        </div>
      </div>
    )
  }

  return (
    <div className="mb-10">
      <div
        className="bg-[--pb-paper] rounded p-2 relative"
        style={{ transform: 'rotate(-0.3deg)', boxShadow: 'var(--pb-shadow-heavy, 0 8px 32px rgba(0,0,0,0.4))' }}
      >
        <Tape variant="tape" className="top-[-8px] left-[35%]" rotate={-2} />
        <Tape variant="tape2" className="top-[-8px] right-[10%]" rotate={3} />
        <Tape variant="tape" className="bottom-[-6px] right-[5%]" rotate={-1} />
        <Image
          src={src!}
          alt={alt}
          width={760}
          height={380}
          className="w-full rounded-sm object-cover"
          style={{ filter: 'brightness(0.92)' }}
          priority
        />
      </div>
      <div className="text-right text-[11px] text-pb-faint italic mt-1.5">bythiagofigueiredo</div>
    </div>
  )
}
