// apps/web/e2e/tests/cms/observatorio/teardown.obs.ts — teardown project of 'observatorio': once every fidelity spec
// ran, the local dev site is left without the oracle data (and the seed marker is forgotten).
import { test as teardown } from '@playwright/test'
import { clearSeeded } from './fidelity'

teardown('clear the observatory seed of the local site', async () => {
  teardown.setTimeout(120_000)
  await clearSeeded()
})
