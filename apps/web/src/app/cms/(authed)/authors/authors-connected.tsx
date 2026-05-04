'use client'

import { useState, useCallback, useTransition, useRef, type FormEvent } from 'react'
import {
  createAuthor,
  updateAuthor,
  deleteAuthor,
  setDefaultAuthor,
  uploadAuthorAvatar,
  updateAuthorAbout,
  uploadAuthorAboutPhoto,
} from './actions'
import { AvatarCropModal } from './avatar-crop-modal'

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface AuthorData {
  id: string
  displayName: string
  slug: string
  bio: string | null
  avatarUrl: string | null
  avatarColor: string | null
  initials: string
  userId: string | null
  socialLinks: Record<string, string>
  sortOrder: number
  isDefault: boolean
  postsCount: number
  headline: string | null
  subtitle: string | null
  aboutMd: string | null
  aboutCompiled: string | null
  aboutPhotoUrl: string | null
  photoCaption: string | null
  photoLocation: string | null
  aboutCtaLinks: {
    kicker: string
    signature: string
    links: Array<{ type: 'internal' | 'social'; key: string; label: string }>
  } | null
}

interface Props {
  authors: AuthorData[]
  readOnly?: boolean
}

type FilterType = 'all' | 'linked' | 'virtual'
type SaveState = 'idle' | 'saving' | 'success' | 'error'

/* ------------------------------------------------------------------ */
/*  Style helpers                                                     */
/* ------------------------------------------------------------------ */

const AVATAR_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
]

function randomColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)] ?? '#6366f1'
}

function inputCls(hasError: boolean): string {
  return `w-full rounded-md border px-3 py-2 text-sm bg-slate-800 text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
    hasError ? 'border-red-500' : 'border-slate-600'
  }`
}

function labelCls(): string {
  return 'block text-sm font-medium text-slate-300 mb-1'
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function FilterPills({
  active,
  onChange,
  counts,
}: {
  active: FilterType
  onChange: (f: FilterType) => void
  counts: { all: number; linked: number; virtual: number }
}) {
  const pills: { id: FilterType; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'linked', label: 'Linked', count: counts.linked },
    { id: 'virtual', label: 'Virtual', count: counts.virtual },
  ]

  return (
    <div className="flex gap-2" role="tablist" aria-label="Author filters">
      {pills.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={active === p.id}
          onClick={() => onChange(p.id)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
            active === p.id
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          {p.label}
          <span className="text-xs opacity-70">({p.count})</span>
        </button>
      ))}
    </div>
  )
}

function AvatarWithFallback({
  src,
  alt,
  initials,
  bgColor,
  size = 48,
  textSize = 'text-sm',
}: {
  src: string | null
  alt: string
  initials: string
  bgColor: string
  size?: number
  textSize?: string
}) {
  const [errored, setErrored] = useState(false)
  const px = `${size / 4}rem`

  if (!src || errored) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${textSize}`}
        style={{ backgroundColor: bgColor, width: size, height: size }}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
      onError={() => setErrored(true)}
    />
  )
}

function AuthorCard({
  author,
  onClick,
  isSelected,
}: {
  author: AuthorData
  onClick: () => void
  isSelected: boolean
}) {
  const bgColor = author.avatarColor ?? '#6366f1'
  const typeBadge = author.userId ? 'Linked' : 'Virtual'
  const typeBadgeCls = author.userId
    ? 'bg-emerald-900/50 text-emerald-400'
    : 'bg-slate-700 text-slate-400'

  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`author-card-${author.id}`}
      className={`w-full text-left rounded-lg border p-4 transition-colors cursor-pointer ${
        isSelected
          ? 'border-indigo-500 bg-slate-800/80'
          : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
      }`}
    >
      <div className="flex items-start gap-3">
        <AvatarWithFallback
          src={author.avatarUrl}
          alt={author.displayName}
          initials={author.initials}
          bgColor={bgColor}
          size={48}
          textSize="text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-200">
              {author.displayName}
            </span>
            {author.isDefault && (
              <span className="rounded-full bg-indigo-900/50 px-2 py-0.5 text-[10px] font-medium text-indigo-400">
                Default
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">@{author.slug}</div>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadgeCls}`}
            >
              {typeBadge}
            </span>
            <span className="text-xs text-slate-500">
              {author.postsCount} post{author.postsCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
      {author.bio && (
        <p className="mt-2 line-clamp-2 text-xs text-slate-400">
          {author.bio}
        </p>
      )}
    </button>
  )
}

function DetailPanel({
  author,
  onClose,
  onUpdate,
  onDelete,
  onSetDefault,
  readOnly,
}: {
  author: AuthorData
  onClose: () => void
  onUpdate: (
    id: string,
    data: {
      display_name?: string
      bio?: string | null
      social_links?: Record<string, string>
      avatar_color?: string | null
    },
  ) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
  readOnly: boolean
}) {
  const [editName, setEditName] = useState(author.displayName)
  const [editBio, setEditBio] = useState(author.bio ?? '')
  const [editColor, setEditColor] = useState(
    author.avatarColor ?? '#6366f1',
  )
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [, startTransition] = useTransition()

  const [activeTab, setActiveTab] = useState<'profile' | 'about'>('profile')

  const [headline, setHeadline] = useState(author.headline ?? '')
  const [subtitle, setSubtitle] = useState(author.subtitle ?? '')
  const [aboutMd, setAboutMd] = useState(author.aboutMd ?? '')
  const [photoCaption, setPhotoCaption] = useState(author.photoCaption ?? '')
  const [photoLocation, setPhotoLocation] = useState(author.photoLocation ?? '')
  const [aboutPhotoUrl, setAboutPhotoUrl] = useState(author.aboutPhotoUrl ?? '')
  const [aboutPhotoUploading, setAboutPhotoUploading] = useState(false)
  const aboutFileRef = useRef<HTMLInputElement>(null)
  const [socialX, setSocialX] = useState(author.socialLinks?.x ?? '')
  const [socialInstagram, setSocialInstagram] = useState(author.socialLinks?.instagram ?? '')
  const [socialYoutube, setSocialYoutube] = useState(author.socialLinks?.youtube ?? '')
  const [socialLinkedin, setSocialLinkedin] = useState(author.socialLinks?.linkedin ?? '')
  const [ctaKicker, setCtaKicker] = useState(author.aboutCtaLinks?.kicker ?? 'Vem junto')
  const [ctaSignature, setCtaSignature] = useState(author.aboutCtaLinks?.signature ?? '')
  const [ctaLinks, setCtaLinks] = useState<Array<{ type: 'internal' | 'social'; key: string; label: string }>>(
    author.aboutCtaLinks?.links ?? [],
  )
  const [aboutSaveState, setAboutSaveState] = useState<SaveState>('idle')

  const bgColor = author.avatarColor ?? '#6366f1'
  const displayAvatar = avatarPreview ?? author.avatarUrl

  const handleAvatarClick = useCallback(() => {
    if (!readOnly) fileInputRef.current?.click()
  }, [readOnly])

  const handleFileSelect = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0]
      if (!file) return
      setCropFile(file)
      ev.target.value = ''
    },
    [],
  )

  const handleCropConfirm = useCallback(
    async (blob: Blob) => {
      setCropFile(null)
      setAvatarPreview(URL.createObjectURL(blob))
      setAvatarUploading(true)
      const fd = new FormData()
      fd.append('file', new File([blob], 'avatar.webp', { type: 'image/webp' }))
      const result = await uploadAuthorAvatar(author.id, fd)
      setAvatarUploading(false)
      if (result.ok) {
        setAvatarPreview(result.url)
      } else {
        setAvatarPreview(null)
        alert(result.error)
      }
    },
    [author.id],
  )

  const handleCropCancel = useCallback(() => {
    setCropFile(null)
  }, [])

  const handleAboutPhotoSelect = useCallback(
    async (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0]
      if (!file) return
      ev.target.value = ''
      setAboutPhotoUploading(true)
      const fd = new FormData()
      fd.append('file', file)
      const result = await uploadAuthorAboutPhoto(author.id, fd)
      setAboutPhotoUploading(false)
      if (result.ok && result.url) {
        setAboutPhotoUrl(result.url)
      }
    },
    [author.id],
  )

  const handleAboutSave = useCallback(async () => {
    if (readOnly) return
    setAboutSaveState('saving')
    const result = await updateAuthorAbout(author.id, {
      headline: headline || undefined,
      subtitle: subtitle || undefined,
      aboutMd: aboutMd || undefined,
      photoCaption: photoCaption || undefined,
      photoLocation: photoLocation || undefined,
      socialLinks: {
        x: socialX,
        instagram: socialInstagram,
        youtube: socialYoutube,
        linkedin: socialLinkedin,
      },
      aboutCtaLinks: ctaLinks.length > 0 ? {
        kicker: ctaKicker,
        signature: ctaSignature,
        links: ctaLinks,
      } : null,
    })
    setAboutSaveState(result.ok ? 'success' : 'error')
    setTimeout(() => setAboutSaveState('idle'), 2000)
  }, [
    author.id, readOnly, headline, subtitle, aboutMd, photoCaption, photoLocation,
    socialX, socialInstagram, socialYoutube, socialLinkedin,
    ctaKicker, ctaSignature, ctaLinks,
  ])

  const addCtaLink = useCallback(() => {
    setCtaLinks((prev) => [...prev, { type: 'internal', key: '', label: '' }])
  }, [])

  const removeCtaLink = useCallback((index: number) => {
    setCtaLinks((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const updateCtaLink = useCallback((index: number, field: string, value: string) => {
    setCtaLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)),
    )
  }, [])

  const handleSave = useCallback(
    (ev: FormEvent) => {
      ev.preventDefault()
      if (readOnly) return
      setSaveState('saving')
      startTransition(async () => {
        onUpdate(author.id, {
          display_name: editName,
          bio: editBio || null,
          avatar_color: editColor,
        })
        setSaveState('success')
        setTimeout(() => setSaveState('idle'), 2000)
      })
    },
    [author.id, editName, editBio, editColor, onUpdate, readOnly],
  )

  const socialEntries = Object.entries(author.socialLinks).filter(
    ([, v]) => v,
  )

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:bg-black/30"
        onClick={onClose}
        data-testid="detail-backdrop"
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto border-l border-slate-700 bg-[#0f172a] p-6 shadow-xl md:w-[400px]"
        role="dialog"
        aria-label="Author details"
        data-testid="detail-panel"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">
            Author Details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200"
            aria-label="Close panel"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Avatar preview + upload */}
        <div className="mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={handleAvatarClick}
            disabled={readOnly}
            className="group relative h-16 w-16 shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a] disabled:cursor-default"
            aria-label="Upload avatar photo"
            data-testid="avatar-upload-btn"
          >
            <AvatarWithFallback
              src={displayAvatar}
              alt={author.displayName}
              initials={author.initials}
              bgColor={bgColor}
              size={64}
              textSize="text-lg"
            />
            {!readOnly && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                {avatarUploading ? (
                  <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="avatar-file-input"
          />
          {cropFile && (
            <AvatarCropModal
              file={cropFile}
              onConfirm={handleCropConfirm}
              onCancel={handleCropCancel}
            />
          )}
          <div>
            <div className="text-base font-semibold text-slate-100">
              {author.displayName}
            </div>
            <div className="text-sm text-slate-500">@{author.slug}</div>
            {!readOnly && (
              <button
                type="button"
                onClick={handleAvatarClick}
                className="mt-0.5 text-xs text-indigo-400 hover:text-indigo-300"
              >
                {displayAvatar ? 'Change photo' : 'Upload photo'}
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-0 border-b border-slate-700">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'profile'
                ? 'border-b-2 border-indigo-500 text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('about')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'about'
                ? 'border-b-2 border-indigo-500 text-slate-100'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            About Page
          </button>
        </div>

        {activeTab === 'profile' && (
          <>
            {/* Edit form */}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="detail-name" className={labelCls()}>
                  Display Name
                </label>
                <input
                  id="detail-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>

              <div>
                <label htmlFor="detail-bio" className={labelCls()}>
                  Bio
                </label>
                <textarea
                  id="detail-bio"
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  className={inputCls(false) + ' resize-none'}
                  disabled={readOnly}
                />
              </div>

              <div>
                <label htmlFor="detail-color" className={labelCls()}>
                  Avatar Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="detail-color"
                    type="text"
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className={inputCls(false) + ' flex-1'}
                    disabled={readOnly}
                  />
                  <span
                    className="inline-block h-8 w-8 shrink-0 rounded-full border border-slate-600"
                    style={{
                      backgroundColor: /^#[0-9A-Fa-f]{6}$/.test(editColor)
                        ? editColor
                        : '#6366f1',
                    }}
                    aria-label="Color preview"
                  />
                </div>
              </div>

              {/* Social links (read-only display) */}
              {socialEntries.length > 0 && (
                <div>
                  <span className={labelCls()}>Social Links</span>
                  <div className="space-y-1">
                    {socialEntries.map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 text-sm text-slate-400"
                      >
                        <span className="font-medium capitalize text-slate-300">
                          {key}:
                        </span>
                        <a
                          href={value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-indigo-400 hover:underline"
                        >
                          {value}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Post count */}
              <div className="rounded-md border border-slate-700 bg-slate-800/50 p-3">
                <span className="text-sm text-slate-300">
                  {author.postsCount} post{author.postsCount !== 1 ? 's' : ''}{' '}
                  assigned
                </span>
              </div>

              {!readOnly && (
                <button
                  type="submit"
                  disabled={saveState === 'saving'}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                >
                  {saveState === 'saving' && (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                  {saveState === 'success' ? 'Saved' : 'Save Changes'}
                </button>
              )}
            </form>

            {/* Actions */}
            {!readOnly && (
              <div className="mt-6 space-y-3 border-t border-slate-700 pt-6">
                {!author.isDefault && (
                  <button
                    type="button"
                    onClick={() => onSetDefault(author.id)}
                    className="w-full rounded-md border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Set as Default Author
                  </button>
                )}

                {/* Danger zone — hidden for default authors */}
                {!author.isDefault && (
                  <div className="rounded-md border border-red-900/50 bg-red-950/20 p-4">
                    <h3 className="text-sm font-medium text-red-400">Danger Zone</h3>
                    {!confirmDelete ? (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="mt-2 text-sm text-red-400 hover:text-red-300"
                        data-testid="delete-author-btn"
                      >
                        Delete Author
                      </button>
                    ) : (
                      <div className="mt-2 space-y-2">
                        <p className="text-xs text-slate-400">
                          {author.postsCount > 0
                            ? 'This author has assigned posts. Reassign them first.'
                            : 'This action cannot be undone.'}
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onDelete(author.id)}
                            disabled={author.postsCount > 0}
                            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-50"
                            data-testid="confirm-delete-btn"
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === 'about' && (
          <div className="space-y-6">
            {/* Headline & Subtitle */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Headline & Subtitle</h3>
              <div>
                <label htmlFor="about-headline" className={labelCls()}>Headline</label>
                <input
                  id="about-headline"
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="eu sou |Thiago."
                  className={inputCls(false)}
                  disabled={readOnly}
                />
                <p className="mt-1 text-xs text-slate-500">Use | to mark the highlighted portion</p>
              </div>
              <div>
                <label htmlFor="about-subtitle" className={labelCls()}>Subtitle</label>
                <input
                  id="about-subtitle"
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="37 anos, brasileiro..."
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* Photo */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">About Photo</h3>
              <div className="flex items-start gap-4">
                {aboutPhotoUrl ? (
                  <img
                    src={aboutPhotoUrl}
                    alt="About photo"
                    className="h-24 w-24 rounded object-cover border border-slate-600"
                  />
                ) : (
                  <div className="flex h-24 w-24 items-center justify-center rounded border border-dashed border-slate-600 bg-slate-800 text-xs text-slate-500">
                    No photo
                  </div>
                )}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => aboutFileRef.current?.click()}
                    disabled={readOnly || aboutPhotoUploading}
                    className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {aboutPhotoUploading ? 'Uploading...' : aboutPhotoUrl ? 'Change photo' : 'Upload photo'}
                  </button>
                  <input
                    ref={aboutFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAboutPhotoSelect}
                    className="hidden"
                  />
                  <p className="text-xs text-slate-500">Square ratio recommended. Max 2 MB.</p>
                </div>
              </div>
              <div>
                <label htmlFor="about-caption" className={labelCls()}>Caption</label>
                <input
                  id="about-caption"
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="CN Tower, fev/2018"
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label htmlFor="about-location" className={labelCls()}>Location</label>
                <input
                  id="about-location"
                  type="text"
                  value={photoLocation}
                  onChange={(e) => setPhotoLocation(e.target.value)}
                  placeholder="TORONTO · 2018"
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* About Text */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">About Text</h3>
              <div>
                <label htmlFor="about-text" className={labelCls()}>Content (Markdown)</label>
                <textarea
                  id="about-text"
                  value={aboutMd}
                  onChange={(e) => setAboutMd(e.target.value)}
                  rows={8}
                  className={inputCls(false) + ' resize-y font-mono text-xs'}
                  placeholder="Write your about text in Markdown..."
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* Social Links */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Social Links</h3>
              <div>
                <label htmlFor="social-x" className={labelCls()}>X (Twitter)</label>
                <input
                  id="social-x"
                  type="url"
                  value={socialX}
                  onChange={(e) => setSocialX(e.target.value)}
                  placeholder="https://x.com/username"
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label htmlFor="social-instagram" className={labelCls()}>Instagram</label>
                <input
                  id="social-instagram"
                  type="url"
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  placeholder="https://instagram.com/username"
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label htmlFor="social-youtube" className={labelCls()}>YouTube</label>
                <input
                  id="social-youtube"
                  type="url"
                  value={socialYoutube}
                  onChange={(e) => setSocialYoutube(e.target.value)}
                  placeholder="https://youtube.com/@channel"
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label htmlFor="social-linkedin" className={labelCls()}>LinkedIn</label>
                <input
                  id="social-linkedin"
                  type="url"
                  value={socialLinkedin}
                  onChange={(e) => setSocialLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* CTA Block */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">CTA Block</h3>
              <div>
                <label htmlFor="cta-kicker" className={labelCls()}>Kicker</label>
                <input
                  id="cta-kicker"
                  type="text"
                  value={ctaKicker}
                  onChange={(e) => setCtaKicker(e.target.value)}
                  placeholder="Vem junto"
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>
              <div>
                <label htmlFor="cta-signature" className={labelCls()}>Signature</label>
                <input
                  id="cta-signature"
                  type="text"
                  value={ctaSignature}
                  onChange={(e) => setCtaSignature(e.target.value)}
                  placeholder="obrigado por estar aqui — tf"
                  className={inputCls(false)}
                  disabled={readOnly}
                />
              </div>

              <div>
                <span className={labelCls()}>Links</span>
                <div className="space-y-2">
                  {ctaLinks.map((link, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={link.type}
                        onChange={(e) => updateCtaLink(i, 'type', e.target.value)}
                        className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-slate-200"
                        disabled={readOnly}
                      >
                        <option value="internal">Internal</option>
                        <option value="social">Social</option>
                      </select>
                      <input
                        type="text"
                        value={link.key}
                        onChange={(e) => updateCtaLink(i, 'key', e.target.value)}
                        placeholder={link.type === 'internal' ? 'blog' : 'instagram'}
                        className={inputCls(false) + ' flex-1'}
                        disabled={readOnly}
                      />
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => updateCtaLink(i, 'label', e.target.value)}
                        placeholder="Label"
                        className={inputCls(false) + ' flex-1'}
                        disabled={readOnly}
                      />
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => removeCtaLink(i)}
                          className="text-red-400 hover:text-red-300"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {!readOnly && ctaLinks.length < 10 && (
                  <button
                    type="button"
                    onClick={addCtaLink}
                    className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    + Add link
                  </button>
                )}
              </div>
            </div>

            {/* Save */}
            {!readOnly && (
              <button
                type="button"
                onClick={handleAboutSave}
                disabled={aboutSaveState === 'saving'}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {aboutSaveState === 'saving' && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {aboutSaveState === 'success' ? 'Saved' : aboutSaveState === 'error' ? 'Error — Retry' : 'Save About Page'}
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function CreateAuthorForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: () => void
}) {
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [color, setColor] = useState(randomColor)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  const handleSubmit = useCallback(
    (ev: FormEvent) => {
      ev.preventDefault()
      if (!name.trim()) {
        setError('Name is required')
        return
      }
      setSaving(true)
      setError('')
      startTransition(async () => {
        const res = await createAuthor({
          display_name: name.trim(),
          bio: bio.trim() || undefined,
          avatar_color: color,
        })
        if (!res.ok) {
          setError(res.error)
          setSaving(false)
          return
        }
        onCreated()
      })
    },
    [name, bio, color, onCreated],
  )

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-4"
      data-testid="create-author-form"
    >
      <h3 className="text-sm font-semibold text-slate-200">New Author</h3>

      <div>
        <label htmlFor="new-author-name" className={labelCls()}>
          Name
        </label>
        <input
          id="new-author-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Author name"
          className={inputCls(!!error)}
        />
      </div>

      <div>
        <label htmlFor="new-author-bio" className={labelCls()}>
          Bio (optional)
        </label>
        <textarea
          id="new-author-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={2}
          className={inputCls(false) + ' resize-none'}
          placeholder="Short bio..."
        />
      </div>

      <div>
        <label htmlFor="new-author-color" className={labelCls()}>
          Avatar Color
        </label>
        <div className="flex gap-2">
          {AVATAR_COLORS.slice(0, 6).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-6 w-6 rounded-full border-2 ${
                color === c ? 'border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Author'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export function AuthorsConnected({ authors, readOnly = false }: Props) {
  const [filter, setFilter] = useState<FilterType>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [, startTransition] = useTransition()

  const counts = {
    all: authors.length,
    linked: authors.filter((a) => a.userId !== null).length,
    virtual: authors.filter((a) => a.userId === null).length,
  }

  const defaultAuthor = authors.find((a) => a.isDefault)
  const defaultIncomplete = defaultAuthor
    ? !defaultAuthor.bio || !defaultAuthor.avatarUrl
    : false
  const missingFields: string[] = []
  if (defaultAuthor && !defaultAuthor.avatarUrl) missingFields.push('avatar')
  if (defaultAuthor && !defaultAuthor.bio) missingFields.push('bio')

  const filtered = authors.filter((a) => {
    if (filter === 'linked') return a.userId !== null
    if (filter === 'virtual') return a.userId === null
    return true
  })

  const selectedAuthor = selectedId
    ? authors.find((a) => a.id === selectedId) ?? null
    : null

  const handleUpdate = useCallback(
    (
      id: string,
      data: {
        display_name?: string
        bio?: string | null
        social_links?: Record<string, string>
        avatar_color?: string | null
      },
    ) => {
      startTransition(async () => {
        await updateAuthor(id, data)
      })
    },
    [],
  )

  const handleDelete = useCallback(
    (id: string) => {
      startTransition(async () => {
        const res = await deleteAuthor(id)
        if (res.ok) {
          setSelectedId(null)
        }
      })
    },
    [],
  )

  const handleSetDefault = useCallback((id: string) => {
    startTransition(async () => {
      await setDefaultAuthor(id)
    })
  }, [])

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0f172a] p-4 md:p-6">
      {/* Header area */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills active={filter} onChange={setFilter} counts={counts} />
        {!readOnly && !showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
            data-testid="create-author-btn"
          >
            Create Author
          </button>
        )}
      </div>

      {/* Default author completeness warning */}
      {defaultIncomplete && (
        <div
          data-testid="default-author-warning"
          className="mb-6 rounded-lg border border-amber-700/50 bg-amber-950/30 p-4"
        >
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-300">
                Default author is missing {missingFields.join(' and ')}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                This may affect how your newsletters appear publicly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6">
          <CreateAuthorForm
            onCancel={() => setShowCreate(false)}
            onCreated={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* Author grid */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-slate-500" data-testid="empty-state">
            {filter === 'all'
              ? 'No authors yet. Create one to get started.'
              : `No ${filter} authors found.`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((author) => (
            <AuthorCard
              key={author.id}
              author={author}
              onClick={() =>
                setSelectedId(selectedId === author.id ? null : author.id)
              }
              isSelected={selectedId === author.id}
            />
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedAuthor && (
        <DetailPanel
          key={selectedAuthor.id}
          author={selectedAuthor}
          onClose={() => setSelectedId(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onSetDefault={handleSetDefault}
          readOnly={readOnly}
        />
      )}
    </div>
  )
}
