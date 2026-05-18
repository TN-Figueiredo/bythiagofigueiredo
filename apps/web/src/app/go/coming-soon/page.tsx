import React from 'react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Em breve',
  robots: 'noindex, nofollow',
}

interface Props {
  searchParams: Promise<{ title?: string; activates?: string }>
}

export default async function ComingSoonPage({ searchParams }: Props) {
  const params = await searchParams
  const title = params.title ?? 'Este link'
  const activatesAt = params.activates ? new Date(params.activates) : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-3 text-2xl font-bold text-white">{title}</h1>
        <p className="text-zinc-400">
          Este link ainda não está ativo.
          {activatesAt && (
            <>
              {' '}Disponível a partir de{' '}
              <time dateTime={activatesAt.toISOString()} className="font-medium text-white">
                {activatesAt.toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Sao_Paulo',
                })}
              </time>
            </>
          )}
        </p>
      </div>
    </main>
  )
}
