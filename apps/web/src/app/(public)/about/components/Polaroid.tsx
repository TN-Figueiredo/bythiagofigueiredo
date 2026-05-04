import Image from 'next/image'

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
        <div
          className="about-tape about-tape-yellow"
          style={{ width: 78, top: -10, left: 30, transform: 'rotate(-5deg)' }}
        />
        <div
          className="about-tape about-tape-blue"
          style={{ width: 64, top: -10, right: 24, transform: 'rotate(4deg)' }}
        />
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
