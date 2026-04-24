import Image from 'next/image'
import { Tape } from '@/app/(public)/components/Tape'

type Props = {
  src: string | null
  alt: string
}

export function CoverImage({ src, alt }: Props) {
  if (!src) return null
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
          src={src}
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
