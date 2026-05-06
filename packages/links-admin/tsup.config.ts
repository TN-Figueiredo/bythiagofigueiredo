import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['esm'],
    dts: true,
    external: ['react', 'react-dom'],
  },
  {
    entry: { client: 'src/client.ts' },
    format: ['esm'],
    dts: true,
    splitting: true,
    treeshake: true,
    external: ['react', 'react-dom'],
    banner: {
      js: "'use client'",
    },
  },
])
