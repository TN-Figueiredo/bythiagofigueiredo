type SectionProps = {
  id: string
  label: string
  title: string
  children: React.ReactNode
  className?: string
}

export function Section({ id, label, title, children, className }: SectionProps) {
  return (
    <section id={id} className={`px-6 py-20 md:py-28 ${className ?? ''}`}>
      <div className="mx-auto max-w-5xl">
        <div className="animate-on-scroll mb-12">
          <span className="mb-3 block text-sm font-semibold tracking-widest uppercase text-primary-500">
            {label}
          </span>
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
            {title}
          </h2>
        </div>
        {children}
      </div>
    </section>
  )
}
