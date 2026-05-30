import type { QrConfig } from '../../types'

export interface QrTemplateData {
  id: string
  name: string
  preview: string
  config: QrConfig
}

export const QR_TEMPLATES: QrTemplateData[] = [
  {
    id: 'standard',
    name: 'Padrao',
    preview: 'qr-standard',
    config: {
      foregroundColor: '#000000',
      backgroundColor: '#FFFFFF',
      logoDataUrl: null,
      errorCorrectionLevel: 'M',
      size: 256,
      format: 'svg',
    },
  },
  {
    id: 'inverted',
    name: 'Invertido',
    preview: 'qr-inverted',
    config: {
      foregroundColor: '#FFFFFF',
      backgroundColor: '#161410',
      logoDataUrl: null,
      errorCorrectionLevel: 'M',
      size: 256,
      format: 'svg',
    },
  },
  {
    id: 'branded',
    name: 'Marca',
    preview: 'qr-branded',
    config: {
      foregroundColor: '#F2683C',
      backgroundColor: '#0D0B08',
      logoDataUrl: null,
      errorCorrectionLevel: 'H',
      size: 256,
      format: 'svg',
    },
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    preview: 'qr-minimal',
    config: {
      foregroundColor: '#2D2B28',
      backgroundColor: '#ECE6DA',
      logoDataUrl: null,
      errorCorrectionLevel: 'L',
      size: 256,
      format: 'svg',
    },
  },
  {
    id: 'ocean',
    name: 'Oceano',
    preview: 'qr-ocean',
    config: {
      foregroundColor: '#1A4B6E',
      backgroundColor: '#E8F4F8',
      logoDataUrl: null,
      errorCorrectionLevel: 'M',
      size: 256,
      format: 'svg',
    },
  },
  {
    id: 'forest',
    name: 'Floresta',
    preview: 'qr-forest',
    config: {
      foregroundColor: '#1B4332',
      backgroundColor: '#D8F3DC',
      logoDataUrl: null,
      errorCorrectionLevel: 'M',
      size: 256,
      format: 'svg',
    },
  },
]

export interface QrCardDesign {
  width: number
  height: number
  bgColor: string
  fgColor: string
  qrSize: number
  qrX: number
  qrY: number
  titleFont: string
  subtitleFont: string
  borderRadius: number
}

export const QR_CARD_DESIGN: QrCardDesign = {
  width: 400,
  height: 520,
  bgColor: '#0D0B08',
  fgColor: '#ECE6DA',
  qrSize: 220,
  qrX: 90,
  qrY: 80,
  titleFont: 'Fraunces, serif',
  subtitleFont: 'Inter, sans-serif',
  borderRadius: 24,
}
