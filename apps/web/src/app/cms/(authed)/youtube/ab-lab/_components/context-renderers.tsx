'use client'

import { YTThumb } from './yt-thumb'

export interface ContextRendererProps {
  thumbUrl?: string
  thumbBg?: string
  title: string
  channelName: string
  views: string
  age: string
  duration: string
  label?: string
}

export function HomeCard({ thumbUrl, thumbBg, title, channelName, views, age, duration, label }: ContextRendererProps) {
  return (
    <div className="w-full">
      <YTThumb
        thumbUrl={thumbUrl}
        thumbBg={thumbBg}
        overlayText={title}
        duration={duration}
        label={label}
        className="w-full aspect-video"
      />
      <div className="flex gap-2 mt-3">
        <div className="size-8 rounded-full bg-cms-surface flex items-center justify-center text-xs font-semibold text-cms-text shrink-0">
          {channelName.charAt(0).toUpperCase()}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm font-medium text-cms-text line-clamp-2 leading-snug">{title}</p>
          <p className="text-2xs text-cms-text-muted">{channelName}</p>
          <p className="text-2xs text-cms-text-dim">{views} · {age}</p>
        </div>
      </div>
    </div>
  )
}

export function SearchRow({ thumbUrl, thumbBg, title, channelName, views, age, duration, label }: ContextRendererProps) {
  return (
    <div className="flex gap-3 w-full">
      <div className="w-[340px] shrink-0">
        <YTThumb
          thumbUrl={thumbUrl}
          thumbBg={thumbBg}
          overlayText={title}
          duration={duration}
          label={label}
        />
      </div>
      <div className="flex flex-col gap-1 min-w-0 pt-1">
        <p className="text-sm font-medium text-cms-text line-clamp-2 leading-snug">{title}</p>
        <p className="text-2xs text-cms-text-muted">{channelName}</p>
        <p className="text-2xs text-cms-text-dim">{views} · {age}</p>
      </div>
    </div>
  )
}

export function SidebarRow({ thumbUrl, thumbBg, title, channelName, views, age, duration, label }: ContextRendererProps) {
  return (
    <div className="flex gap-2 w-full">
      <div className="w-[168px] shrink-0">
        <YTThumb
          thumbUrl={thumbUrl}
          thumbBg={thumbBg}
          overlayText={title}
          duration={duration}
          label={label}
          mini
        />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 pt-0.5">
        <p className="text-xs font-medium text-cms-text line-clamp-2 leading-snug" style={{ fontSize: '13px' }}>{title}</p>
        <p className="text-2xs text-cms-text-muted">{channelName}</p>
        <p className="text-2xs text-cms-text-dim">{views} · {age}</p>
      </div>
    </div>
  )
}

export function MobilePhone({ thumbUrl, thumbBg, title, channelName, views, age, duration, label }: ContextRendererProps) {
  return (
    <div className="w-[375px] rounded-[40px] border-2 border-cms-border bg-black overflow-hidden">
      <div className="w-[120px] h-[28px] bg-black rounded-b-2xl mx-auto" />
      <div className="bg-[#0f0f0f]">
        <YTThumb
          thumbUrl={thumbUrl}
          thumbBg={thumbBg}
          overlayText={title}
          duration={duration}
          label={label}
          className="rounded-none"
        />
        <div className="px-3 py-2 flex flex-col gap-0.5">
          <p className="text-xs font-medium text-white truncate">{title}</p>
          <p className="text-xs text-white/60">{channelName}</p>
          <p className="text-xs text-white/40">{views} · {age}</p>
        </div>
      </div>
    </div>
  )
}
