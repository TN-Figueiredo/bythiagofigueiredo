import { Mail } from 'lucide-react'

export function HubNewsletter() {
  return (
    <section className="px-6 pb-12">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 md:p-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/10 text-primary-500">
            <Mail size={20} />
          </div>
          <h2 className="mb-2 text-xl font-bold md:text-2xl">
            Receba updates direto na tua caixa
          </h2>
          <p className="mb-5 text-sm text-[var(--text-secondary)]">
            Notas semanais sobre o que estou construindo, lições e bastidores.
            Sem spam, sem firula. Cancele quando quiser.
          </p>

          <form
            action="/api/newsletter"
            method="post"
            className="flex flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              name="email"
              required
              placeholder="seu@email.com"
              aria-label="Email para newsletter"
              className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-sm placeholder:text-[var(--text-tertiary)] focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
            <button
              type="submit"
              className="rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/20 transition-all hover:-translate-y-0.5 hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-600/30"
            >
              Inscrever
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
