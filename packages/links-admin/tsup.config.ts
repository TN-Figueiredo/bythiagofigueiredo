import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    external: ['react', 'react-dom', 'konva', 'react-konva', 'qrcode'],
  },
  {
    entry: { client: 'src/client.ts' },
    format: ['esm'],
    dts: true,
    splitting: false,
    treeshake: false,
    external: ['react', 'react-dom', 'konva', 'react-konva', 'qrcode'],
    banner: {
      js: '"use client";',
    },
  },
])
