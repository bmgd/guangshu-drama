import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const adaptersDir = join(root, 'src/services/adapters')

test('errors.ts has mapProviderError and CONTENT_REVIEW', () => {
  const file = join(adaptersDir, 'errors.ts')
  assert.ok(existsSync(file), 'errors.ts missing')
  const src = readFileSync(file, 'utf8')
  assert.match(src, /mapProviderError/)
  assert.match(src, /CONTENT_REVIEW/)
})

test('url.ts has assertReachableMediaUrl or requirePublicMediaUrl', () => {
  const file = join(adaptersDir, 'url.ts')
  assert.ok(existsSync(file), 'url.ts missing')
  const src = readFileSync(file, 'utf8')
  assert.ok(
    /assertReachableMediaUrl/.test(src) || /requirePublicMediaUrl/.test(src),
    'expected assertReachableMediaUrl or requirePublicMediaUrl',
  )
})
