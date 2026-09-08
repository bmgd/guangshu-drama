import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const adaptersDir = join(root, 'src/services/adapters')

test('aliyun wan adapter encodes DashScope async + media/parameters', () => {
  const file = join(adaptersDir, 'aliyun-wan-video.ts')
  assert.ok(existsSync(file), 'aliyun-wan-video.ts missing')
  const src = readFileSync(file, 'utf8')
  assert.match(src, /X-DashScope-Async/)
  assert.ok(
    /input\.media|media\b/.test(src) || /video-synthesis/.test(src),
    'expected input.media or video-synthesis',
  )
  assert.match(src, /parameters/)
})

test('aliyun submit request shape (source / mock contract)', async () => {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init })
    return {
      ok: true,
      async json() {
        return { output: { task_id: 'mock-aliyun-1' } }
      },
      async text() {
        return ''
      },
    }
  }

  try {
    const src = readFileSync(join(adaptersDir, 'aliyun-wan-video.ts'), 'utf8')
    assert.match(src, /video-synthesis/)
    assert.match(src, /'X-DashScope-Async':\s*'enable'/)
    assert.equal(calls.length, 0, 'source assertion path does not invoke fetch')
  } finally {
    globalThis.fetch = originalFetch
  }
})
