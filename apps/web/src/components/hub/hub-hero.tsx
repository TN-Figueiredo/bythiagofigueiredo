export function HubHero() {
  return (
    <section className="px-6 pt-32 pb-12 text-center">
      <div className="mx-auto max-w-2xl">
        {/* Avatar */}
        <div className="mx-auto mb-6 h-24 w-24 overflow-hidden rounded-full border-2 border-primary-500/30 ring-4 ring-primary-500/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/profile.png"
            alt="Thiago Figueiredo"
            className="h-full w-full object-cover"
          />
        </div>

        <span className="mb-4 inline-block rounded-full border border-primary-500/20 bg-primary-500/10 px-4 py-1.5 text-xs font-semibold tracking-wider uppercase text-primary-400">
          Creator & Builder
        </span>

        <h1 className="mb-4 text-3xl font-extrabold leading-tight tracking-tight md:text-5xl">
          Build in public.
          <br />
          <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
            Learn out loud.
          </span>
        </h1>

        <p className="mx-auto max-w-md text-base leading-relaxed text-[var(--text-secondary)] md:text-lg">
          Acompanhe projetos, lançamentos e experimentos. Founder da Figueiredo
          Technology, construindo o ecossistema @tnf/* na frente de todo mundo.
        </p>
      </div>
    </section>
  )
}
