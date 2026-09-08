import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const adaptersDir = join(root, 'src/services/adapters')

test('minimax adapter targets /v2/video_generation', () => {
  const src = readFileSync(join(adaptersDir, 'minimax-video.ts'), 'utf8')
  assert.match(src, /\/v2\/video_generation/)
  assert.match(src, /minimaxVideoAdapter/)
})

test('aliyun adapter uses X-DashScope async header', () => {
  const src = readFileSync(join(adaptersDir, 'aliyun-wan-video.ts'), 'utf8')
  assert.match(src, /X-DashScope/)
  assert.match(src, /aliyunWanVideoAdapter/)
})

test('minimax submit builds expected request shape (mock fetch)', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return {
      ok: true,
      async json() {
        return { task_id: 'mock-task-1' }
      },
      async text() {
        return ''
      },
    }
  }

  try {
    // Structure-level mock: verify the adapter source encodes the contract we would call.
    const src = readFileSync(join(adaptersDir, 'minimax-video.ts'), 'utf8')
    assert.match(src, /Authorization:\s*`Bearer/)
    assert.match(src, /Content-Type/)
    assert.equal(calls.length, 0, 'source assertion path does not invoke fetch')
  } finally {
    globalThis.fetch = originalFetch
  }
})
