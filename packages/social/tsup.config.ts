import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'core/token-vault': 'src/core/token-vault.ts',
    'core/media-validator': 'src/core/media-validator.ts',
    'core/content-adapter': 'src/core/content-adapter.ts',
    'providers/youtube': 'src/providers/youtube/index.ts',
    'providers/meta': 'src/providers/meta/index.ts',
    'providers/bluesky': 'src/providers/bluesky/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  treeshake: true,
  clean: true,
  outDir: 'dist',
  external: ['@googleapis/youtube', '@atproto/api'],
})
