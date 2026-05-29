'use client'

import { Link2, Mail, BookOpen, Youtube, Globe, Users, Phone, Heart } from 'lucide-react'

const ICON_MAP: Record<string, typeof Link2> = {
  links: Link2, mail: Mail, blog: BookOpen, youtube: Youtube,
  globe: Globe, authors: Users, contacts: Phone, heart: Heart,
}

function getIcon(name: string, size = 16) {
  const Icon = ICON_MAP[name] ?? Link2
  return <Icon size={size} />
}

function TFStamp({ size = 56 }: { size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size, height: size,
        border: '1.5px solid #E0651E',
        color: '#ECE6DA',
        fontFamily: 'Fraunces, serif',
        fontWeight: 700,
        fontSize: size * 0.34,
      }}
    >
      <span>T<span className="italic">F</span></span>
    </div>
  )
}

function TreeRow({ icon, iconColor = '#E0574E', title, sub }: {
  icon: string; iconColor?: string; title: string; sub?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-[11px] border border-white/[0.08] bg-white/[0.025] px-3.5 py-[11px]">
      <span
        className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg"
        style={{ background: iconColor + '22' }}
      >
        <span style={{ color: iconColor }}>{getIcon(icon, 16)}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-semibold text-[#ECE6DA]" style={{ fontFamily: 'Fraunces, serif' }}>{title}</div>
        {sub && <div className="mt-0.5 font-mono text-[10px] text-[#A39C8E]">{sub}</div>}
      </div>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6E685D" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
    </div>
  )
}

interface SharedLinkDisplay {
  id: string
  icon: string
  label_pt: string
  label_en: string
  url: string
}

interface LinktreePreviewProps {
  width?: number
  taglinePt: string
  taglineEn: string
  sharedLinks: SharedLinkDisplay[]
}

export function LinktreePreview({ width = 300, taglinePt, taglineEn, sharedLinks }: LinktreePreviewProps) {
  return (
    <div
      className="flex flex-col gap-3.5 rounded-2xl border border-white/10 p-[22px_18px]"
      style={{ width, background: '#13110d', fontFamily: 'Inter, sans-serif' }}
    >
      {/* PT/EN toggle */}
      <div className="mb-0.5 flex justify-center gap-1.5">
        {['PT', 'EN'].map((l) => (
          <span key={l} className="rounded-full border border-white/[0.15] px-[9px] py-[3px] font-mono text-[10px] font-bold"
            style={{ color: l === 'EN' ? '#F2683C' : '#A39C8E' }}>{l}</span>
        ))}
      </div>

      {/* Header */}
      <div className="flex flex-col items-center gap-1.5 text-center">
        <TFStamp size={54} />
        <div className="mt-0.5 text-[19px] font-semibold text-[#ECE6DA]" style={{ fontFamily: 'Fraunces, serif' }}>Thiago Figueiredo</div>
        <div className="font-mono text-[10.5px] tracking-[0.04em] text-[#A39C8E]">{taglinePt}</div>
      </div>

      {/* Latest post card */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="border-l-2 border-[#F2683C] px-[13px] py-[10px]">
          <div className="mb-[3px] font-mono text-[8.5px] uppercase tracking-[0.16em] text-[#F2683C]">ULTIMO POST</div>
          <div className="text-[13px] font-semibold leading-tight text-[#ECE6DA]" style={{ fontFamily: 'Fraunces, serif' }}>I Learned a Language by Arguing with Strangers Online</div>
        </div>
      </div>

      {/* English section */}
      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-[#6E685D]">ENGLISH</div>
      <div className="flex flex-col gap-2">
        <TreeRow icon="blog" iconColor="#46B17E" title="Blog" sub="code, product & indie life" />
        <TreeRow icon="mail" iconColor="#E0A23C" title="Thiago&#39;s Journal" sub="Newsletter Weekly" />
        <TreeRow icon="youtube" title="YouTube" sub="@bythiagofigueiredo" />
      </div>

      {/* Portuguese section */}
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-[#6E685D]">PORTUGUES</div>
      <div className="flex flex-col gap-2">
        <TreeRow icon="blog" iconColor="#46B17E" title="Blog" sub="codigo, produto e vida indie" />
        <TreeRow icon="mail" iconColor="#E0A23C" title="Diario do Thiago" sub="Newsletter Semanal" />
      </div>

      {/* Shared links */}
      {sharedLinks.length > 0 && (
        <div className="mt-1 flex flex-col gap-2">
          {sharedLinks.map((s) => (
            <TreeRow key={s.id} icon={s.icon} iconColor="#8A8F98" title={s.label_pt} />
          ))}
        </div>
      )}

      {/* Social icons */}
      <div data-testid="social-icons" className="mt-2 flex justify-center gap-4 text-[#6E685D]">
        {[Youtube, Youtube, BookOpen, Users].map((Icon, i) => (
          <Icon key={i} size={16} />
        ))}
      </div>
    </div>
  )
}
