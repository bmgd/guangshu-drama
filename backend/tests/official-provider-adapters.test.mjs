import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const adaptersDir = join(root, 'src/services/adapters')

test('official video provider adapters exist', () => {
  for (const name of ['minimax-video.ts', 'aliyun-wan-video.ts', 'volcengine-video.ts']) {
    assert.ok(existsSync(join(adaptersDir, name)), `missing adapter: ${name}`)
  }
})

test('registry mentions minimax and aliyun', () => {
  const registry = readFileSync(join(adaptersDir, 'registry.ts'), 'utf8')
  assert.match(registry, /minimax/)
  assert.match(registry, /aliyun/)
})
