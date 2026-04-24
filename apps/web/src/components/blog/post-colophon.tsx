type Props = { text: string | undefined }

export function PostColophon({ text }: Props) {
  if (!text) return null
  return (
    <div className="my-6 py-6 border-t border-dashed border-[--pb-line] border-b flex gap-6 items-start">
      <div className="blog-sidebar-label min-w-[60px] pt-0.5">COLOFAO</div>
      <p className="text-sm text-pb-muted italic leading-relaxed">{text}</p>
    </div>
  )
}
