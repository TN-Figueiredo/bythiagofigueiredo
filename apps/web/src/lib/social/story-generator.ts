import { ImageResponse } from '@vercel/og'
import React from 'react'

export type StoryTemplate = 'minimal' | 'card' | 'bold'

export interface StoryData {
  title: string
  description?: string
  domain: string
  shortUrl: string
  coverImageUrl?: string
  logoUrl?: string
}

const STORY_WIDTH = 1080
const STORY_HEIGHT = 1920

function MinimalTemplate({ data }: { data: StoryData }) {
  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0a0a',
        padding: '80px',
      },
    },
    data.logoUrl
      ? React.createElement('img', {
          src: data.logoUrl,
          width: 60,
          height: 60,
          style: { position: 'absolute', top: 60, left: 60, borderRadius: '8px' },
        })
      : null,
    React.createElement(
      'div',
      {
        style: {
          fontSize: '48px',
          fontWeight: 700,
          color: '#fafafa',
          textAlign: 'center',
          lineHeight: 1.3,
          maxWidth: '920px',
          display: 'flex',
          overflow: 'hidden',
        },
      },
      data.title,
    ),
    React.createElement(
      'div',
      {
        style: {
          position: 'absolute',
          bottom: 120,
          fontSize: '24px',
          color: '#a1a1aa',
          fontFamily: 'monospace',
          display: 'flex',
        },
      },
      data.shortUrl,
    ),
  )
}

function CardTemplate({ data }: { data: StoryData }) {
  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        background: data.coverImageUrl
          ? undefined
          : 'linear-gradient(180deg, #0a0a0a 0%, #1a1a2e 100%)',
        padding: '80px',
      },
    },
    data.coverImageUrl
      ? React.createElement('img', {
          src: data.coverImageUrl,
          style: {
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(20px) brightness(0.3)',
          },
        })
      : null,
    React.createElement(
      'div',
      {
        style: {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'rgba(10, 10, 10, 0.75)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '24px',
          padding: '48px',
          maxWidth: '920px',
          zIndex: 1,
        },
      },
      data.logoUrl
        ? React.createElement('img', {
            src: data.logoUrl,
            width: 48,
            height: 48,
            style: { borderRadius: '8px', marginBottom: '24px' },
          })
        : null,
      React.createElement(
        'div',
        {
          style: {
            fontSize: '40px',
            fontWeight: 700,
            color: '#fafafa',
            textAlign: 'center',
            lineHeight: 1.3,
            display: 'flex',
          },
        },
        data.title,
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: '20px',
            color: '#a78bfa',
            marginTop: '16px',
            display: 'flex',
          },
        },
        data.domain,
      ),
      React.createElement(
        'div',
        {
          style: {
            fontSize: '22px',
            color: '#22d3ee',
            fontFamily: 'monospace',
            marginTop: '12px',
            display: 'flex',
          },
        },
        data.shortUrl,
      ),
    ),
  )
}

function BoldTemplate({ data }: { data: StoryData }) {
  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #06b6d4 100%)',
        padding: '80px',
      },
    },
    data.logoUrl
      ? React.createElement('img', {
          src: data.logoUrl,
          width: 72,
          height: 72,
          style: { position: 'absolute', top: 60, right: 60, borderRadius: '12px' },
        })
      : null,
    React.createElement(
      'div',
      { style: { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center' } },
      React.createElement(
        'div',
        {
          style: {
            fontSize: '56px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.2,
            display: 'flex',
          },
        },
        data.title,
      ),
      data.description
        ? React.createElement(
            'div',
            {
              style: {
                fontSize: '24px',
                color: 'rgba(255,255,255,0.8)',
                marginTop: '24px',
                lineHeight: 1.4,
                display: 'flex',
              },
            },
            data.description,
          )
        : null,
    ),
    React.createElement(
      'div',
      {
        style: {
          fontSize: '26px',
          color: '#ffffff',
          background: 'rgba(0,0,0,0.3)',
          padding: '12px 24px',
          borderRadius: '12px',
          fontFamily: 'monospace',
          alignSelf: 'flex-start',
          display: 'flex',
        },
      },
      data.shortUrl,
    ),
  )
}

const TEMPLATES: Record<StoryTemplate, (props: { data: StoryData }) => React.ReactElement> = {
  minimal: MinimalTemplate,
  card: CardTemplate,
  bold: BoldTemplate,
}

export async function generateStoryImage(
  template: StoryTemplate,
  data: StoryData,
): Promise<Buffer> {
  const TemplateComponent = TEMPLATES[template]
  if (!TemplateComponent) {
    throw new Error(`Unknown story template: ${template}`)
  }
  const element = React.createElement(TemplateComponent, { data })

  const response = new ImageResponse(element, {
    width: STORY_WIDTH,
    height: STORY_HEIGHT,
  })

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
