import { ArrowDown } from 'lucide-react'

export function Hero() {
  return (
    <section
      id="top"
      className="relative flex min-h-[90vh] items-center px-6 pt-24 pb-16"
    >
      <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-5">
        {/* Text — 3 cols */}
        <div className="md:col-span-3">
          <span className="mb-4 inline-block rounded-full border border-primary-500/20 bg-primary-500/10 px-4 py-1.5 text-sm font-semibold text-primary-400">
            Founder & Builder
          </span>
          <h1 className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight md:text-6xl lg:text-7xl">
            Oi, eu sou Thiago.
            <br />
            <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              Construo produtos digitais
            </span>{' '}
            que conectam pessoas e marcas.
          </h1>
          <p className="mb-8 max-w-lg text-lg leading-relaxed text-[var(--text-secondary)]">
            Mais de 12 anos de experiência construindo produtos full stack.
            Fundador da Figueiredo Technology. Especializado em React, TypeScript
            e Node.js.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="#projects"
              className="inline-flex items-center rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-600/30"
            >
              Ver projetos
            </a>
            <a
              href="#contact"
              className="inline-flex items-center rounded-xl border border-[var(--border)] px-6 py-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-primary-500/40 hover:bg-primary-500/5"
            >
              Entrar em contato
            </a>
          </div>
        </div>

        {/* Image placeholder — 2 cols */}
        <div className="hidden md:col-span-2 md:flex md:justify-end">
          <div className="relative h-72 w-72 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] lg:h-80 lg:w-80">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/profile.png"
              alt="Thiago Figueiredo"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <a
        href="#about"
        aria-label="Rolar para baixo"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-[var(--text-tertiary)]"
      >
        <ArrowDown size={20} />
      </a>
    </section>
  )
}
