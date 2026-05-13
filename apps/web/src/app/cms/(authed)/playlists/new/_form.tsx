'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { slugifyPlaylist } from '@/lib/playlists/slug'
import { createPlaylist } from '../actions'

interface Props {
  siteId: string
}

export function NewPlaylistForm({ siteId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')

  function handleNameChange(value: string) {
    setName(value)
    if (!slugEdited) {
      setSlug(slugifyPlaylist(value))
    }
  }

  function handleSlugChange(value: string) {
    setSlug(value)
    setSlugEdited(true)
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    startTransition(async () => {
      const result = await createPlaylist(siteId, {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        status: 'draft',
      })

      if (!result.ok) {
        toast.error(result.error === 'slug_already_exists'
          ? 'That slug is already in use. Try a different one.'
          : result.error)
        return
      }

      router.push(`/cms/playlists/${result.data.id}`)
    })
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">New Playlist</h1>
        <p className="mt-1 text-sm text-white/50">
          Create a playlist to organize and connect your content.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Name */}
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-white/70">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="e.g. Getting Started with TypeScript"
            required
            maxLength={200}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Slug */}
        <div className="flex flex-col gap-2">
          <label htmlFor="slug" className="text-sm font-medium text-white/70">
            Slug <span className="text-red-400">*</span>
          </label>
          <input
            id="slug"
            type="text"
            value={slug}
            onChange={e => handleSlugChange(e.target.value)}
            placeholder="getting-started-with-typescript"
            required
            maxLength={200}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            title="Lowercase letters, numbers and hyphens only"
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 font-mono text-sm text-white placeholder-white/25 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <p className="text-xs text-white/30">Lowercase letters, numbers and hyphens only.</p>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="text-sm font-medium text-white/70">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="A short description of what this playlist covers…"
            rows={3}
            maxLength={1000}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Category */}
        <div className="flex flex-col gap-2">
          <label htmlFor="category" className="text-sm font-medium text-white/70">
            Category
          </label>
          <input
            id="category"
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="e.g. TypeScript, Web Dev, Tutorials"
            maxLength={100}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending || !name.trim() || !slug.trim()}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Creating…' : 'Create Playlist'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/cms/playlists')}
            disabled={isPending}
            className="rounded-lg border border-white/10 px-5 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/20 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
