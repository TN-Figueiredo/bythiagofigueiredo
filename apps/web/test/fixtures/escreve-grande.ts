import { escreverTudo } from '@/lib/youtube/observatorio/arquivo/escrever'
void (async () => { await escreverTudo('x'.repeat(1_000_000) + '\n'); process.exit(0) })()
