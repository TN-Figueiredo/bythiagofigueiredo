// scripts/seed-social-templates.ts
// Usage: npx tsx --env-file apps/web/.env.local scripts/seed-social-templates.ts
//
// Seeds 9 default social templates (3 per aspect ratio) into social_templates.
// Fully idempotent — uses ON CONFLICT DO NOTHING on (name) for global defaults.

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
})

// ---------------------------------------------------------------------------
// Template definitions
// ---------------------------------------------------------------------------

interface TemplateRow {
  name: string
  aspect_ratio: '9:16' | '1:1' | '16:9'
  composition: Record<string, unknown>
  is_default: boolean
  site_id: null
}

// ── 9:16 Story templates ──

const blogAnnounceStory: TemplateRow = {
  name: 'blog-announce-story',
  aspect_ratio: '9:16',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
    background: {
      type: 'gradient',
      angle: 135,
      stops: [
        { color: '#7c3aed', position: 0 },
        { color: '#2563eb', position: 0.5 },
        { color: '#06b6d4', position: 1 },
      ],
    },
    elements: [
      {
        id: 'logo',
        type: 'image',
        x: 60, y: 60, width: 72, height: 72,
        rotation: 0, opacity: 1, locked: true,
        src: '{{logo}}',
        objectFit: 'cover',
        borderRadius: 12, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
      {
        id: 'title',
        type: 'text',
        x: 80, y: 700, width: 920, height: 400,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Bebas Neue', fontSize: 72, fontWeight: 700,
        lineHeight: 1.1, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: true,
      },
      {
        id: 'description',
        type: 'text',
        x: 80, y: 1120, width: 920, height: 200,
        rotation: 0, opacity: 0.8, locked: false,
        content: '{{description}}',
        fontFamily: 'Inter', fontSize: 28, fontWeight: 400,
        lineHeight: 1.4, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'short-url',
        type: 'text',
        x: 80, y: 1720, width: 920, height: 60,
        rotation: 0, opacity: 1, locked: false,
        content: '{{short_url}}',
        fontFamily: 'JetBrains Mono', fontSize: 24, fontWeight: 400,
        lineHeight: 1.2, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: '#00000050', backgroundPadding: 12, backgroundRadius: 8,
        uppercase: false,
      },
    ],
  },
}

const quoteCardStory: TemplateRow = {
  name: 'quote-card-story',
  aspect_ratio: '9:16',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
    background: { type: 'solid', color: '#0a0a0a' },
    elements: [
      {
        id: 'cover',
        type: 'image',
        x: 0, y: 0, width: 1080, height: 1920,
        rotation: 0, opacity: 0.35, locked: true,
        src: '{{cover_image}}',
        objectFit: 'cover',
        borderRadius: 0, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: false,
      },
      {
        id: 'title',
        type: 'text',
        x: 80, y: 760, width: 920, height: 400,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Playfair Display', fontSize: 56, fontWeight: 700,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 490, y: 1680, width: 100, height: 100,
        rotation: 0, opacity: 0.8, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 16, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
    ],
  },
}

const videoPromoStory: TemplateRow = {
  name: 'video-promo-story',
  aspect_ratio: '9:16',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1920, aspectRatio: '9:16' },
    background: { type: 'solid', color: '#111111' },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 120, y: 800, width: 840, height: 300,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Inter', fontSize: 44, fontWeight: 600,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#fafafa',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 480, y: 600, width: 120, height: 120,
        rotation: 0, opacity: 0.7, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 20, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
      {
        id: 'short-url',
        type: 'text',
        x: 240, y: 1200, width: 600, height: 50,
        rotation: 0, opacity: 0.6, locked: false,
        content: '{{short_url}}',
        fontFamily: 'Space Mono', fontSize: 20, fontWeight: 400,
        lineHeight: 1.2, letterSpacing: '0em', align: 'center',
        color: '#a1a1aa',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
    ],
  },
}

// ── 1:1 Square templates ──

const blogAnnounceSquare: TemplateRow = {
  name: 'blog-announce-square',
  aspect_ratio: '1:1',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
    background: {
      type: 'gradient',
      angle: 180,
      stops: [
        { color: '#0a0a0a', position: 0 },
        { color: '#1a1a2e', position: 1 },
      ],
    },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 80, y: 360, width: 920, height: 300,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Bebas Neue', fontSize: 64, fontWeight: 700,
        lineHeight: 1.1, letterSpacing: '0em', align: 'center',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: true,
      },
      {
        id: 'logo',
        type: 'image',
        x: 490, y: 80, width: 100, height: 100,
        rotation: 0, opacity: 0.8, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 16, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
      {
        id: 'short-url',
        type: 'text',
        x: 80, y: 920, width: 920, height: 50,
        rotation: 0, opacity: 0.6, locked: false,
        content: '{{short_url}}',
        fontFamily: 'JetBrains Mono', fontSize: 20, fontWeight: 400,
        lineHeight: 1.2, letterSpacing: '0em', align: 'center',
        color: '#a1a1aa',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
    ],
  },
}

const quoteCardSquare: TemplateRow = {
  name: 'quote-card-square',
  aspect_ratio: '1:1',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
    background: { type: 'solid', color: '#0f0f0f' },
    elements: [
      {
        id: 'cover',
        type: 'image',
        x: 0, y: 0, width: 1080, height: 1080,
        rotation: 0, opacity: 0.25, locked: true,
        src: '{{cover_image}}',
        objectFit: 'cover',
        borderRadius: 0, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: false,
      },
      {
        id: 'title',
        type: 'text',
        x: 100, y: 340, width: 880, height: 300,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Playfair Display', fontSize: 48, fontWeight: 700,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'description',
        type: 'text',
        x: 120, y: 680, width: 840, height: 120,
        rotation: 0, opacity: 0.7, locked: false,
        content: '{{description}}',
        fontFamily: 'Inter', fontSize: 22, fontWeight: 400,
        lineHeight: 1.4, letterSpacing: '0em', align: 'center',
        color: '#d4d4d8',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
    ],
  },
}

const videoPromoSquare: TemplateRow = {
  name: 'video-promo-square',
  aspect_ratio: '1:1',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1080, height: 1080, aspectRatio: '1:1' },
    background: { type: 'solid', color: '#18181b' },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 100, y: 400, width: 880, height: 200,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Inter', fontSize: 40, fontWeight: 600,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#fafafa',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 460, y: 200, width: 160, height: 160,
        rotation: 0, opacity: 0.6, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 24, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
    ],
  },
}

// ── 16:9 Landscape templates ──

const blogAnnounceLandscape: TemplateRow = {
  name: 'blog-announce-landscape',
  aspect_ratio: '16:9',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1280, height: 720, aspectRatio: '16:9' },
    background: {
      type: 'gradient',
      angle: 135,
      stops: [
        { color: '#7c3aed', position: 0 },
        { color: '#2563eb', position: 1 },
      ],
    },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 60, y: 200, width: 800, height: 280,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Bebas Neue', fontSize: 64, fontWeight: 700,
        lineHeight: 1.1, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: true,
      },
      {
        id: 'description',
        type: 'text',
        x: 60, y: 500, width: 800, height: 80,
        rotation: 0, opacity: 0.8, locked: false,
        content: '{{description}}',
        fontFamily: 'Inter', fontSize: 22, fontWeight: 400,
        lineHeight: 1.4, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 1140, y: 40, width: 100, height: 100,
        rotation: 0, opacity: 0.8, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 16, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
      {
        id: 'short-url',
        type: 'text',
        x: 60, y: 620, width: 400, height: 40,
        rotation: 0, opacity: 0.7, locked: false,
        content: '{{short_url}}',
        fontFamily: 'JetBrains Mono', fontSize: 18, fontWeight: 400,
        lineHeight: 1.2, letterSpacing: '0em', align: 'left',
        color: '#ffffff',
        backgroundColor: '#00000040', backgroundPadding: 8, backgroundRadius: 6,
        uppercase: false,
      },
    ],
  },
}

const quoteCardLandscape: TemplateRow = {
  name: 'quote-card-landscape',
  aspect_ratio: '16:9',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1280, height: 720, aspectRatio: '16:9' },
    background: { type: 'solid', color: '#0a0a0a' },
    elements: [
      {
        id: 'cover',
        type: 'image',
        x: 0, y: 0, width: 1280, height: 720,
        rotation: 0, opacity: 0.3, locked: true,
        src: '{{cover_image}}',
        objectFit: 'cover',
        borderRadius: 0, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: false,
      },
      {
        id: 'title',
        type: 'text',
        x: 120, y: 220, width: 1040, height: 250,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Playfair Display', fontSize: 52, fontWeight: 700,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#ffffff',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 590, y: 560, width: 100, height: 100,
        rotation: 0, opacity: 0.7, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 16, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
    ],
  },
}

const videoPromoLandscape: TemplateRow = {
  name: 'video-promo-landscape',
  aspect_ratio: '16:9',
  is_default: true,
  site_id: null,
  composition: {
    version: 1,
    canvas: { width: 1280, height: 720, aspectRatio: '16:9' },
    background: { type: 'solid', color: '#111111' },
    elements: [
      {
        id: 'title',
        type: 'text',
        x: 160, y: 260, width: 960, height: 200,
        rotation: 0, opacity: 1, locked: false,
        content: '{{title}}',
        fontFamily: 'Inter', fontSize: 44, fontWeight: 600,
        lineHeight: 1.3, letterSpacing: '0em', align: 'center',
        color: '#fafafa',
        backgroundColor: null, backgroundPadding: 8, backgroundRadius: 4,
        uppercase: false,
      },
      {
        id: 'logo',
        type: 'image',
        x: 560, y: 100, width: 160, height: 120,
        rotation: 0, opacity: 0.5, locked: false,
        src: '{{logo}}',
        objectFit: 'contain',
        borderRadius: 20, borderColor: '#000000', borderWidth: 0,
        maintainAspectRatio: true,
      },
    ],
  },
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const TEMPLATES: TemplateRow[] = [
  blogAnnounceStory,
  quoteCardStory,
  videoPromoStory,
  blogAnnounceSquare,
  quoteCardSquare,
  videoPromoSquare,
  blogAnnounceLandscape,
  quoteCardLandscape,
  videoPromoLandscape,
]

async function main() {
  console.log(`Seeding ${TEMPLATES.length} social templates...`)

  for (const tmpl of TEMPLATES) {
    const { data, error } = await supabase
      .from('social_templates')
      .upsert(
        {
          name: tmpl.name,
          aspect_ratio: tmpl.aspect_ratio,
          composition: tmpl.composition,
          is_default: tmpl.is_default,
          site_id: tmpl.site_id,
        },
        { onConflict: 'name', ignoreDuplicates: false },
      )
      .select('id, name')

    if (error) {
      // If upsert fails (no unique constraint on name), try insert with conflict check
      const { error: insertErr } = await supabase
        .from('social_templates')
        .insert({
          name: tmpl.name,
          aspect_ratio: tmpl.aspect_ratio,
          composition: tmpl.composition,
          is_default: tmpl.is_default,
          site_id: tmpl.site_id,
        })

      if (insertErr) {
        if (insertErr.code === '23505') {
          // Duplicate — update instead
          const { error: updateErr } = await supabase
            .from('social_templates')
            .update({
              aspect_ratio: tmpl.aspect_ratio,
              composition: tmpl.composition,
              is_default: tmpl.is_default,
              updated_at: new Date().toISOString(),
            })
            .is('site_id', null)
            .eq('name', tmpl.name)

          if (updateErr) {
            console.error(`  FAIL ${tmpl.name}: ${updateErr.message}`)
          } else {
            console.log(`  UPDATED ${tmpl.name}`)
          }
        } else {
          console.error(`  FAIL ${tmpl.name}: ${insertErr.message}`)
        }
      } else {
        console.log(`  INSERTED ${tmpl.name}`)
      }
    } else {
      const row = data?.[0]
      console.log(`  OK ${tmpl.name} → ${row?.id ?? '(upserted)'}`)
    }
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
