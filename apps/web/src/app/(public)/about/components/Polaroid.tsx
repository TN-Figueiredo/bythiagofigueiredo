import Image from 'next/image'
import { Tape } from '@/app/(public)/components/Tape'

interface PolaroidProps {
  photoUrl: string
  caption: string | null
  location: string | null
  displayName: string
}

export function Polaroid({ photoUrl, caption, location, displayName }: PolaroidProps) {
  return (
    <div className="about-polaroid">
      <div className="about-polaroid-frame">
        <Tape className="top-[-10px] left-[30px]" rotate={-5} />
        <Tape variant="tape2" className="top-[-10px] right-[24px]" rotate={4} />
        <Image
          src={photoUrl}
          alt={displayName}
          width={292}
          height={292}
          className="about-polaroid-photo"
          priority
        />
        {caption && <div className="about-polaroid-caption">{caption}</div>}
        {location && <div className="about-polaroid-location">{location}</div>}
      </div>
    </div>
  )
}
