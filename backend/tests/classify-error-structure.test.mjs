import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('generation.ts has classifyError and withTransientRetry', () => {
  const file = join(root, 'src/services/generation.ts')
  assert.ok(existsSync(file), 'generation.ts missing')
  const src = readFileSync(file, 'utf8')
  assert.match(src, /classifyError/)
  assert.match(src, /withTransientRetry/)
})
